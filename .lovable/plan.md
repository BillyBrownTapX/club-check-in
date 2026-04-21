
Upgrade Attendance HQ so student identity is scoped to the university inherited from each event’s club, while keeping the current product structure intact and making the public check-in flow much faster on mobile.

1. Database and relationship rebuild
- Add a new `universities` table with:
  - `id`
  - `name`
  - `slug`
  - `created_at`
  - `updated_at`
- Add `university_id` to:
  - `clubs` as required after backfill
  - `students` as required after backfill
  - `events` as required after backfill for simpler public check-in queries
- Add foreign keys:
  - `clubs.university_id -> universities.id`
  - `students.university_id -> universities.id`
  - `events.university_id -> universities.id`
- Keep `events.club_id` as the primary ownership link and treat `events.university_id` as a persisted derived value.
- Replace the current global student uniqueness with university-scoped uniqueness:
  - remove the old unique behavior on `students.nine_hundred_number`
  - add `unique(university_id, nine_hundred_number)`
- Keep or confirm `unique(event_id, student_id)` on `attendance_records` to prevent duplicate check-ins.
- Add indexes for:
  - `clubs.university_id`
  - `events.university_id`
  - `students.university_id`
  - `students(university_id, nine_hundred_number)`

2. Safe migration and backfill strategy
- Create a migration that preserves existing data and backfills in phases.
- Since the chosen approach is “best effort + review”:
  - create a placeholder university record for unresolved legacy data only if needed to preserve app function
  - backfill `events.university_id` from their club when a club can be resolved
  - backfill `students.university_id` from attendance/event/club relationships when determinable
- For clubs/events/students that cannot be resolved confidently:
  - mark them for manual review through nullable interim migration steps
  - only enforce `NOT NULL` after backfill completes
- Update generated types through the normal backend tooling after migration.

3. RLS and security updates
- Add RLS for `universities` appropriate to current host ownership patterns.
- Update club/event visibility and management logic to respect university linkage while preserving host ownership checks.
- Update any helper SQL functions that infer student visibility to work through:
  - `attendance_records -> events -> clubs -> host`
  - and/or `students.university_id`
- Keep roles in the separate `user_roles` table as-is.

4. Shared domain type updates
- Update `src/lib/attendance-hq.ts` to add:
  - `University` type
  - university-aware `Club`, `Event`, and `Student` payloads
  - event payloads that include the club’s university for host screens and public check-in
- Extend summary/detail types so club and event UIs can display the linked university cleanly.

5. Validation schema changes
- Update `src/lib/attendance-hq-schemas.ts`:
  - `clubSchema` and `clubUpdateSchema` must require `universityId`
  - keep event validation focused on `clubId`, with university resolved server-side from the selected club
  - keep student public validation minimal:
    - first name
    - last name
    - student email
    - 900 number
- Preserve existing 900-number and email validation behavior.

6. Backend logic refactor for clubs and events
- Update club create/edit server functions so clubs cannot be saved without a university.
- Update event create/edit/duplicate logic so:
  - selected club is verified as owned by the host
  - `events.university_id` is always derived from the selected club on write
  - changing an event’s club also refreshes the event’s university
- Update event form payload loaders so club selections can expose university context to hosts.

7. University-scoped student lookup and check-in backend
- Refactor the public check-in server functions in `src/lib/attendance-hq.functions.ts` so every public flow first resolves:
  - event by `qr_token`
  - event’s club/university context
- Replace all student lookup queries from:
  - `nine_hundred_number = ?`
  to:
  - `university_id = scopedUniversityId`
  - `nine_hundred_number = submitted900`
- Update these functions:
  - `getPublicEventByQr`
  - `studentCheckIn`
  - `lookupStudent`
  - `confirmReturningStudent`
  - `getRememberedStudent`
  - `fastCheckIn`
- Ensure first-time creation inserts `students.university_id`.
- Handle concurrent first-time submissions safely:
  - rely on `unique(university_id, nine_hundred_number)`
  - if insert collides, re-read the student and continue gracefully
- Keep duplicate attendance protection:
  - if `(event_id, student_id)` already exists, return a friendly already-checked-in state

8. Remembered-device behavior update
- Keep remembered-device support, but make it university-safe by ensuring:
  - the device session’s student belongs to the scoped event university before returning a preview or recording attendance
- Preserve the current security improvement where the client never submits arbitrary student IDs.

9. Public student check-in UX rebuild
- Rework `src/routes/check-in.$qrToken.tsx` and `src/components/attendance-hq/public-check-in.tsx` into a progressive mobile flow:
  - State 1: 900 number lookup only
  - State 2A: returning student confirmation
  - State 2B: first-time creation form with prefilled 900 number
  - State 3: success / already checked in
- Remove the current “first-time form first, returning second” structure.
- Make the default entry screen:
  - event header
  - club name
  - one 900 number field
  - strong “Find my account” CTA
- If lookup fails:
  - route directly into the short first-time form
  - keep the 900 number filled in
  - show concise copy like “We couldn’t find your account”
- If lookup succeeds:
  - show welcome-back confirmation with masked reassurance details
  - strong “Check me in” CTA
- If already checked in:
  - show a success-style confirmation instead of a harsh error wall

10. Club management UX updates
- Update club creation/edit flows in:
  - `src/routes/onboarding.club.tsx`
  - `src/routes/clubs.index.tsx`
  - `src/routes/clubs.$clubId.tsx`
  - `src/components/attendance-hq/host-management.tsx`
- Add a required university selector to club forms and dialogs.
- Show the selected university in club cards/details so hosts can verify context quickly.
- Add clear empty/loading/error states if no universities exist yet.

11. Event UX updates
- Update event forms and event detail context so hosts can see the inherited university without editing it directly.
- In:
  - `src/routes/events.new.tsx`
  - `src/routes/events.$eventId.edit.tsx`
  - `src/routes/onboarding.event.tsx`
  - `src/components/attendance-hq/host-management.tsx`
- When a host selects a club, show the resolved university as read-only context.
- Prevent any event flow from drifting out of sync with its club’s university.

12. Operational review flow for unresolved legacy mappings
- Add a lightweight host-facing review path for clubs needing university assignment after migration.
- At minimum:
  - block saving/updating affected clubs until a university is selected
  - surface missing-university messaging in club/event management and onboarding
- If needed, route hosts with unresolved clubs into the correct edit/setup step rather than letting downstream flows fail silently.

13. Technical implementation notes
- Use a migration for schema changes only.
- Keep all backend logic in TanStack server functions; do not move this to separate edge tooling.
- Preserve current mobile enterprise styling direction while simplifying the student flow.
- Do not expose technical database language on student-facing screens.
- Do not ask students to choose a university anywhere.

14. Validation and QA after implementation
- Verify host flows:
  - create club with university
  - edit club university
  - create event from club and confirm inherited university
  - edit event club and confirm university updates
- Verify public check-in flows:
  - returning student in same university succeeds with 900 lookup
  - unknown 900 routes to first-time form
  - first-time student is created once per university
  - same 900 in a different university is treated as a different student
  - already checked in returns friendly confirmation
  - remembered device only works for the correct university-scoped student
- Verify data integrity:
  - no duplicate student rows for the same university and 900 number
  - no duplicate attendance rows for the same event and student
  - legacy data remains accessible and unresolved records are reviewable
