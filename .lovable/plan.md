# Guided first-run for new host accounts

## Goal

A brand-new host, right after creating their account, is walked through two steps with no dead ends:

1. Land on Clubs with the "Create Club" sheet already open.
2. After the club saves, land straight on the Create Event page with that club preselected.
3. After the event saves, land on the event page and the guided run ends — the app behaves normally from then on.

Nothing is mandatory: the host can close the sheet or leave the event page at any point and keep using the app. Existing hosts never see this flow.

## How a "new host" is identified

The account is marked as new at the moment of sign-up (not by guessing from data), and the marker is stored per-browser-session for that specific user id. It is cleared as soon as the guided run finishes or the host closes out of it. Consequences:

- Existing accounts signing in normally are never marked, so they land on Home exactly as today.
- If a project setting requires email confirmation, the marker is re-established on the first sign-in that follows account creation, so the flow still triggers once for that new account.

## Flow details

- Post-auth routing: new host goes to `/clubs` with the create sheet open instead of `/home`. Owner-admin routing is untouched.
- Clubs page: when the guided flag is present, the create sheet auto-opens and shows a short one-line "Step 1 of 2" hint. Closing it clears the flag (no nagging).
- Club created: instead of the current jump to the club detail page, the guided run navigates to `/events/new?clubId=<new club>`.
- Create Event page: shows a "Step 2 of 2" hint when guided. Existing behavior (templates, duplicate, no-club bounce) is unchanged.
- Event created: existing navigation to the event page is kept; the guided flag is cleared so the next visit is a normal one.
- The old `/onboarding/club` and `/onboarding/event` routes stay in place and untouched so any in-flight links keep working.

## Technical notes

- New tiny helper module for the first-run marker (read/set/clear, keyed by user id, `sessionStorage`), so no schema or server changes are needed.
- `useResolvePostAuthRedirect` in `src/components/attendance-hq/host-management.tsx` gains the new-host branch that targets `/clubs`.
- `src/routes/sign-up.tsx` sets the marker on successful sign-up.
- `src/routes/clubs.index.tsx`: auto-open the dialog from the marker, redirect to `/events/new` after create when guided.
- `src/routes/events.new.tsx`: guided hint plus clearing the marker after a successful create.
- No changes to server functions, RLS, or database.
