# Pre-check-in roster on event ops

Two changes to the event operations page (`/events/$eventId`):

1. **Show who pre-checked in.** The Early head count card currently shows only counts. Add a roster of the students who pre-checked in — name, email, 900 number, when they joined, and whether they actually showed up on the day (converted vs. no-show).
2. **Remove "New Link" and "Turn Off" buttons.** The Early head count card keeps Share QR / Copy Link; the regenerate-token and disable actions go away.

## How it works

- **Data** — `getEventOperations` in `src/lib/attendance-hq.functions.ts` already reads `pre_check_ins` for the counts. Extend that same fetch to join `students` (name, email, 900 number, `checked_in_at`, `check_in_method`) and mark each row `converted: true/false` by checking against the day-of attendance set it already builds. Add a `preCheckIns: PreCheckInListRow[]` field to the payload (new type in `src/lib/attendance-hq.ts`). No new server function, no schema changes — existing RLS already scopes reads to event hosts.
- **UI** — In `src/routes/events.$eventId.tsx`, under the head-count stats in the Early head count card, render a compact list (same visual style as the attendance roster): student name, masked-detail row, "Joined …" timestamp, and a small badge — green "Checked in" if converted, neutral "Not yet" otherwise. Empty state: "No one on the early head count yet."
- **Button removal** — Delete the "New Link" and "Turn Off" `SecondaryButton`s and their handlers (`handleRegeneratePreToken`, the `handleTogglePreCheckIn(false)` usage). Keep the "Turn on early head count" button shown when the feature is off, and keep the `togglePreCheckIn` / `regeneratePreCheckInToken` server functions in place (unused server code, no behavior change — removal can be a later cleanup).

## Technical details

- Files touched: `src/lib/attendance-hq.ts` (new `PreCheckInListRow` type + payload field), `src/lib/attendance-hq.functions.ts` (`getEventOperations` fetch), `src/routes/events.$eventId.tsx` (roster UI, button removal).
- No database migration, no new routes, no changes to the public pre-check-in page or day-of check-in flows.
- Verify: load event ops for an event with pre-check-ins, confirm roster + badges render, buttons gone; confirm an event with pre-check-in off is unchanged.
