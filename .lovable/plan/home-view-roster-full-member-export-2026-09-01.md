# Home "View Roster" → full member export

Today the "View Roster" tile on Home navigates to the live/recent event (or the events list). Change it to download one CSV containing every person who has checked in or pre-checked in to any event across all clubs the signed-in host belongs to.

## Behavior

- Tile label stays "View Roster", hint becomes "Export all members".
- Tapping it downloads `attendance-hq-members-<date>.csv` via the browser's native download (anchor click with a short-lived session token in the URL, same approach as the existing event and semester exports).
- While the export runs the tile shows a busy state and is not re-triggerable; errors surface as a toast ("Your session expired…" or "Export failed").
- If the host has no clubs/events, the CSV downloads with just the header row.

## CSV contents

One row per unique student, deduplicated across all events:

| Column | Meaning |
| --- | --- |
| First name, Last name, Student email, 900 number | student identity |
| University | student's university name |
| Clubs | comma-joined club names the student attended |
| Events attended | count of distinct events checked in |
| Pre-check-ins | count of distinct events pre-checked in |
| First check-in, Last check-in | earliest/latest timestamp across both sources |

Sorted by last name, then first name.

## Technical notes

- New server route: `src/routes/api.host.members[.]csv.ts` → `/api/host/members.csv`, modeled directly on `api.host.clubs.$clubId.semester-attendance[.]csv.ts` (user-scoped publishable-key client + `?token=`, `getClaims` verification, RLS does the access control — no admin client).
- Query flow: read the host's clubs (RLS-filtered), then their events, then page `attendance_records` and `pre_check_ins` for those event ids in 1000-row chunks, aggregating per student in memory; emit a streamed CSV with BOM and `Content-Disposition`.
- `src/routes/home.tsx`: the `ActionTile` for "View Roster" switches from `navigate(...)` to an export handler using `session?.access_token` from the auth provider, mirroring `handleExportCsv` in `events.$eventId.tsx`.
- No schema changes, no changes to existing export routes.
