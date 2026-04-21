

## Add Delete buttons for Clubs and Events

Let hosts remove a club or event they no longer want. Both get a clearly-labeled destructive button with a confirmation step so nothing is nuked by accident.

### Where Delete appears

**Clubs**
- Club detail page (`/clubs/$clubId`) — new red "Delete Club" button in the action row next to Edit Club. After success, navigate back to `/clubs`.
- Edit Club dialog — a "Delete Club" option inside the dialog (secondary/destructive style) for parity.

**Events**
- Event detail page (`/events/$eventId`) — "Delete Event" button in the top action area. After success, navigate back to `/events`.
- Event edit page (`/events/$eventId/edit`) — "Delete Event" at the bottom of the form.
- EventCard (used on `/clubs/$clubId`, `/events`) — small trash icon next to Duplicate so you can remove an event straight from the list.

Each trigger opens the existing `AlertDialog` confirmation with:
- Title: "Delete this club?" / "Delete this event?"
- Warning copy listing what gets removed (see below).
- Destructive confirm button labeled "Delete" with an `isSubmitting` guard so it can't be double-clicked.

### What gets deleted (cascade behavior)

Because the current database has no FK cascade declarations, deleting a parent row with child rows would fail. The server functions will delete children in order, inside a single transaction-ish sequence, scoped to the authenticated host (RLS already guarantees ownership):

- **Delete event** → delete `attendance_actions` for event → delete `attendance_records` for event → delete `events` row.
- **Delete club** → for each event in the club, run the event-delete cascade → delete `event_templates` for club → delete `clubs` row.

No changes to the DB schema or RLS — both operations stay within the existing "hosts can manage own clubs/events" policies.

### Files changed

- `src/lib/attendance-hq-schemas.ts`
  - Add `deleteClubSchema` (`{ clubId: uuid }`) and `deleteEventSchema` (`{ eventId: uuid }`).

- `src/lib/attendance-hq.functions.ts`
  - Add `deleteClub` server function — verifies ownership via `requireOwnedClub`, cascades through events + templates as described, returns `{ ok: true }`.
  - Add `deleteEvent` server function — verifies ownership via `requireOwnedEvent`, cascades through attendance_actions + attendance_records, returns `{ ok: true }`.

- `src/components/attendance-hq/host-management.tsx`
  - Add a reusable `DeleteConfirmButton` (button + AlertDialog + submitting guard) so the same pattern is used everywhere.
  - `ClubDialog`: add an optional `onDelete?: () => Promise<void>` prop; when present, render `DeleteConfirmButton` at the bottom of the dialog.
  - `EventCard`: add optional `onDelete?: (eventId: string) => Promise<void>`; render a small destructive icon button next to Duplicate when provided.

- `src/routes/clubs.$clubId.tsx`
  - Wire `deleteClub` into the action row and into `ClubDialog` (`onDelete`). On success: `toast.success`, navigate to `/clubs`.

- `src/routes/events.$eventId.tsx`
  - Add a "Delete Event" button in the header action area. On success: `toast.success`, navigate to `/events`.

- `src/routes/events.$eventId.edit.tsx`
  - Add a "Delete Event" button at the bottom of the edit form. Same confirm + nav behavior.

- `src/routes/events.index.tsx` and the event cards rendered inside `src/routes/clubs.$clubId.tsx`
  - Pass `onDelete` to `EventCard` so deletion from the list works. On success: refetch the list / club detail.

### Guardrails

- Confirmation dialog is required — no one-click deletes.
- Every delete button disables while the request is in flight (reuses the same `isSubmitting` pattern we just added for creates).
- Server functions re-verify ownership — the UI cannot bypass RLS.
- Error surfaces through `getManagementErrorMessage` + `toast.error` so failures (e.g. network, RLS) show a clear message instead of silently failing.

### Out of scope

- No "soft delete / archive" toggle. Clubs already have `is_active` and events already have `is_archived`; this is an explicit destructive delete.
- No bulk delete. One club / one event at a time.
- No undo. The confirmation dialog is the safety net.

