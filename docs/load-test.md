# Load-test — public check-in (100–200 concurrent)

Purpose: prove the shared-NAT venue design (see `src/lib/rate-limit.server.ts`)
holds before a large meeting. A whole room of phones behind one campus egress
IP must be able to check in within a minute, with retries, without the
rate-limiter locking the room out.

The harness lives at `scripts/load-check-in.ts` and is Bun-runnable.
It fires the public first-time check-in flow via the thin HTTP adapter at
`POST /api/public/student-check-in`, which reuses the exact same server
handler and rate-limit budgets as the real UI. **No auth bypass, no
rate-limit bypass, ever.**

## Prerequisites

1. On the environment you're targeting (prefer **preview**), create a
   **throwaway event** on a throwaway club and open its check-in window.
2. Open the event's check-in URL — the QR token is the last path segment of
   `/check-in/<qrToken>`. Copy it.
3. The event's owning club/university must accept the email domain you'll
   use for synthetic students (default `ung.edu`).

## Rate limits the harness is measuring against

Defined in `src/lib/rate-limit.server.ts` for the `register` scope
(first-time check-in):

| bucket           | budget          |
|------------------|-----------------|
| per-IP           | 80 / 60s        |
| per-QR (global)  | 400 / 60s       |

A `burst` at concurrency 150 from one machine will produce 429s **by
design** — that is the shared-NAT budget doing its job. `venue` mode adds
small jitter and up to 3 retries per worker to model what a real room of
phones on one NAT experiences.

## Commands

Always target preview first:

```bash
bun run load:check-in -- \
  --baseUrl https://id-preview--<uuid>.lovable.app \
  --qrToken <qrToken> \
  --concurrency 150 \
  --scenario burst
```

Model a real venue (with retries on 429):

```bash
bun run load:check-in -- \
  --baseUrl https://id-preview--<uuid>.lovable.app \
  --qrToken <qrToken> \
  --concurrency 200 \
  --total 200 \
  --scenario venue
```

Production hosts (`attendance-hq.com`, `checkin-swiftly.lovable.app`) are
refused unless you pass `--confirmProduction`. Only do this against a
throwaway event on production, with the room owner aware.

### Flags

| flag                  | default   | notes                                          |
|-----------------------|-----------|------------------------------------------------|
| `--baseUrl`           | required  | env `LOAD_BASE_URL`                            |
| `--qrToken`           | required  | env `LOAD_QR_TOKEN` (never logged raw)         |
| `--concurrency`       | 150       | hard-capped at 200                             |
| `--total`             | =concurrency | for sustained load, ≥ concurrency          |
| `--scenario`          | burst     | `burst` or `venue`                             |
| `--emailDomain`       | ung.edu   | must be allowed by the event's university      |
| `--idPrefix`          | 891       | first 3 digits of synthetic 9-digit ids        |
| `--confirmProduction` | false     | required for production hosts                  |

## Interpreting the report

The script prints counts by outcome and p50 / p95 / max latency for `ok`
responses:

- **`ok`** — real check-in row written.
- **`already_checked_in`** — same synthetic student was already in.
  Expected on retries in `venue` mode; a first `ok` followed by 429s that
  eventually get retried can land here.
- **`other_blocked`** — a public-flow soft state (e.g. `student_exists`,
  `event_not_open`, `invalid_email_domain`). Read the state values in the
  script output.
- **`rate_limited`** (HTTP 429) — per-IP or per-QR budget tripped.
  Expected in `burst` above 80 concurrent from one IP; if you see this in
  `venue` mode, retries didn't win — try more retries or lower concurrency.
- **`http_5xx`** — real server error. Investigate.
- **`network_error`** — TCP/TLS/DNS failure. Investigate.

In `venue` mode the script exits non-zero if `http_5xx + network_error`
exceeds 10% of requests — that's an outage signal, not a rate-limit
artifact. In every other case it exits 0 (so you can inspect counts in
CI without a false red).

## Cleanup

The script **never deletes anything**. Synthetic rows are marked
predictably so a human can inspect and remove them:

- student emails match `loadtest+%@<emailDomain>`
- 900 numbers start with your `--idPrefix` (default `891`)

Human cleanup, run in the backend SQL console:

```sql
-- Inspect first
select id, first_name, last_name, student_email, nine_hundred_number, university_id
  from public.students
 where student_email like 'loadtest+%@ung.edu'
    or nine_hundred_number like '891%';

-- Attendance rows created by this run (limit to your throwaway event!)
select id, event_id, student_id, checked_in_at
  from public.attendance_records
 where event_id = '<your-throwaway-event-id>';
```

Delete only after you're sure the ids belong to the load run and not to
real students who happen to share a domain. The retention purge flow
(P2.8) is not designed for this cleanup.

## When to run it

- Before any meeting expected to draw > 60 attendees on one venue Wi-Fi.
- Whenever `CHECK_IN_RATE_LIMITS` or `CHECK_IN_GLOBAL_RATE_LIMITS` change.
- After deploys that touch the public check-in server functions or the
  rate-limit helper.
