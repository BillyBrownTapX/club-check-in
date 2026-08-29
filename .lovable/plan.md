# Pre-Event Check-In (early head count)

Add an optional "Pre Check-In" window to any event so members can tap in days or weeks ahead. It produces a marketing head count only — it never touches attendance numbers, rosters, reports, or CSV exports.

## How it works for hosts

- On the event form (create and edit) a new optional block: **Pre check-in (early head count)**.
  - Toggle: off by default, so existing behavior is unchanged.
  - When on: pick a pre check-in **opens at** and **closes at** date+time. The window can be any length (minutes to months) and may extend right up to the event; the only rules are close-after-open and close no later than the event's day-of check-in close.
- Event detail page gains a **Pre check-in** card (only when enabled):
  - Big early head-count number, plus a compact list of who tapped in (name, 900 number, timestamp).
  - Copy link, show QR, and open the shareable pre check-in page — a separate URL and QR from the day-of code, safe to post in flyers, group chats, and Instagram.
  - Rotate pre check-in link (same pattern as the existing QR regenerate) and Disable pre check-in.
  - CSV export of the pre check-in list.
- Events list / dashboard: a small "early: N" chip on events with pre check-in enabled. No existing counts change.

## How it works for members

- New public page at `/pre-check-in/<token>`, styled like the current student check-in page.
- Same fields as real check-in (first name, last name, campus email, 900 number), same email-domain gate, same 900-number validation, same remembered-device fast path.
- Copy makes clear this is not attendance: "You're on the early head count — remember to check in at the event."
- Duplicate taps are idempotent (one pre check-in per student per event).
- Before/after the pre window: friendly "not open yet" / "closed" states, mirroring the current check-in states.
- A member who pre-checked-in must still check in at the event; nothing is auto-marked present.

## Not changed

Attendance records, live ops counts, semester report, host activity milestones, retention purge, existing QR tokens and links, existing event validation. Pre check-in data is separate and additive.

## Technical outline

**Database migration (additive only)**
- `events`: add `pre_check_in_enabled boolean not null default false`, `pre_check_in_opens_at timestamptz`, `pre_check_in_closes_at timestamptz`, `pre_check_in_token text unique`. Existing rows default to disabled with nulls.
- New `public.pre_check_ins`: `id`, `event_id -> events(id) on delete cascade`, `student_id -> students(id)`, `checked_in_at`, `check_in_method` (reuse existing enum), `created_at`, `updated_at`, unique `(event_id, student_id)`, index on `event_id`.
- GRANTs: `SELECT, INSERT, UPDATE, DELETE` to `authenticated`; `ALL` to `service_role`; no `anon` grant (public writes go through the server function with the admin client, like today's check-in).
- Enable RLS; policies gated on the existing `is_event_host(event_id)` helper for host read/insert/update/delete.
- `updated_at` trigger.
- Validation trigger on `events` (not a CHECK, since it compares timestamps): when `pre_check_in_enabled`, both timestamps required, close > open, and close <= `check_in_closes_at`.
- Extend `is_student_visible_to_host` to also consider `pre_check_ins`, so hosts can read student rows that only pre-checked-in.

**Schemas (`src/lib/attendance-hq-schemas.ts`)**
- Extend `eventSchema` with optional `preCheckInEnabled`, `preCheckInOpensAt`, `preCheckInClosesAt`; add refinements that only fire when enabled (no length cap on the window).
- New `preCheckInInputSchema`, `preCheckInReturningSchema`, `preCheckInRememberedSchema` (reuse `qrTokenSchema` shape), `eventIdInputSchema` reuse for host reads, and `togglePreCheckInSchema` / `regeneratePreCheckInTokenSchema`.

**Server functions (`src/lib/attendance-hq.functions.ts`)**
- Write-through in `createEvent`, `updateEvent`, `duplicateEvent` (shift pre window by the same day offset as `shiftEventScheduleByDays`), and `getEventFormPayload` (return the new fields).
- Public, unauthenticated (same rate-limit + admin-client pattern as `studentCheckIn`): `getPreCheckInEvent`, `preCheckInStudent`, `lookupPreCheckInStudent`, `fastPreCheckIn`. Each resolves the event by `pre_check_in_token`, enforces the window, the university email domain gate, and per-university 900-number binding, then upserts into `pre_check_ins`.
- Host-side, `requireSupabaseAuth` + `requireActiveHost`: `getEventPreCheckIns`, `regeneratePreCheckInToken`, `disablePreCheckIn`.
- `getEventDetail` / event summaries add a `preCheckInCount` alongside existing counts (additive field).

**UI**
- `src/components/attendance-hq/host-management.tsx`: pre check-in fieldset in `EventForm` (toggle + two datetime fields, hidden when off).
- `src/routes/events.$eventId.tsx`: pre check-in card in the ops left rail with count, list, copy link, QR, rotate, disable, CSV link.
- New `src/routes/pre-check-in.$preToken.tsx`: public page reusing `public-check-in.tsx` primitives, offline banner, and draft persistence.
- New `src/routes/api.host.events.$eventId.pre-check-ins[.]csv.ts` for export.
- `src/lib/query-keys.ts`: `events.preCheckIns(eventId)` key.
- `src/lib/attendance-hq.ts`: `getPreCheckInStatus()` helper + copy constants; `src/integrations/supabase/types.ts` regenerated after the migration.
- `robots.txt`/sitemap untouched; the public pre check-in route is `noindex` like `/check-in`.

**Order of work**: migration first (approval required), then schemas + server functions, then host UI, then the public page and CSV route.
