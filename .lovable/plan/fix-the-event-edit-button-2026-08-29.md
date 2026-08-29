# Fix the event Edit button

## What's happening

Confirmed by loading `/events/<id>/edit` in a browser against the running app: the URL changes correctly, but the page that renders is the event operations page (roster, QR, history) — the edit form never appears. So the button *does* navigate; the wrong screen is drawn, which looks like "nothing happened".

Cause: `src/routes/events.$eventId.tsx` is both the page for `/events/$eventId` and, because of file-based routing, the parent of `/events/$eventId/edit`. A parent route must render `<Outlet />` for its children to mount. That file renders the ops page instead, so the child edit route is matched but never rendered. The same applies to `/events/$eventId/display`.

## The fix

Detach the two child screens from the ops page so they are siblings, not children, using TanStack Router's trailing-underscore convention (URLs stay exactly the same):

- Rename `events.$eventId.edit.tsx` → `events.$eventId_.edit.tsx` and change its route id to `/events/$eventId_/edit`.
- Rename `events.$eventId.display.tsx` → `events.$eventId_.display.tsx` and change its route id to `/events/$eventId_/display`.
- Update the link/navigation targets to the new route ids (URLs unchanged, so bookmarks and shared links keep working):
  - `src/routes/events.$eventId.tsx` (edit pencil in the header)
  - `src/components/attendance-hq/host-management.tsx` ("Edit event" action sheet item)
  - `src/routes/live.tsx` (Edit + QR links)
  - `src/routes/home.tsx` ("Show QR" tile)

Nothing else changes: the ops page keeps its own path, search params, and metadata; `getEventFormPayload`, `updateEvent`, and `deleteEvent` are untouched; the display screen keeps its current behavior.

## Verification

- Open an event → tap the pencil: the "Edit Event" form renders prefilled (including the pre-event check-in section), Save Changes returns to the event, Cancel and Delete Event behave as before.
- Same check from the events list action sheet and from the Live page Edit link.
- Open the QR display screen from Live and Home to confirm it still renders.
- Typecheck passes; the generated route tree regenerates itself.

## Technical notes

Alternative considered: convert `events.$eventId.tsx` into a layout returning `<Outlet />` and move its body to a new `events.$eventId.index.tsx`. Equivalent result, but it relocates ~1100 lines of ops code plus `validateSearch`/`head`, which is riskier for zero user-visible gain. The underscore approach is a two-file rename plus four link updates.
