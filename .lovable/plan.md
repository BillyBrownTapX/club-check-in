# Fix: clubs sometimes don't open on the first tap

## What's actually wrong

Confirmed root cause, not a guess: on the club detail screen a React hook is
created *after* the screen's early "Loading club…" exits.

In `src/routes/clubs.$clubId.tsx` the component returns early while it is
loading (lines 175-183), and only then — on line 188 — creates the
"email agent setup link" mutation hook. React requires the same hooks in the
same order on every render. So the sequence on a first open is:

```text
tap club  -> render #1: loading placeholder      (hook not created)
data ready-> render #2: full page                (extra hook appears)
          -> React throws "Rendered more hooks than during the previous render"
          -> the route's error boundary swallows the page
```

Tap it again and the club data is already cached (15s freshness), so render #1
is already the full page, the hook count is stable, and the page opens
normally. That is exactly the "doesn't open the first time, works the second
time" behaviour being reported.

## Secondary issue found in the same flow

Every host screen is held behind two sequential checks: session hydration plus
a server round-trip that asks "is this the owner account?". While that probe is
in flight, `/clubs` renders a bare "Loading…" block instead of the club cards,
so a tap that starts on the placeholder and finishes just as the cards appear
lands on a node that was replaced mid-gesture and is lost. This is most likely
on the first visit after sign-in (the answer is cached for 5 minutes
afterwards), and it compounds the primary bug.

## The fix

1. **Move the hook above the early returns** in `src/routes/clubs.$clubId.tsx`:
   create `agentEmailMutation` (and keep `handleEmailAgentSetup` with it)
   alongside the other mutations near the top of the component, so hook order
   never changes between the loading and loaded renders. No behaviour change.
2. **Audit the sibling host routes for the same pattern** (`clubs.index.tsx`,
   `events.index.tsx`, `events.$eventId.tsx`, `events.$eventId_.edit.tsx`,
   `events.new.tsx`, `home.tsx`, `live.tsx`, `settings.tsx`, `agents.tsx`,
   `notifications.tsx`, `admin.tsx`, owner-admin routes) and hoist any other
   hook that sits below a conditional return.
3. **Stop the loading placeholder from stealing taps on `/clubs`**: render the
   club list skeleton in the same layout position as the real rows, so the
   card list is not swapped out from under a finger, and keep the list mounted
   once data has arrived rather than reverting to a full-screen placeholder on
   background refetches.
4. **Verify** by driving the running app in a mobile viewport: load `/clubs`
   cold, tap the first club once, and confirm the detail page renders with no
   console error; repeat with a cleared client cache.

## Technical notes

- Item 1 is the actual bug fix; items 2-3 are hardening against the same class.
- Guard against regressions with the existing lint setup: enable/verify the
  React hooks rule so a hook below a conditional return fails lint instead of
  reaching users.
- No database, RLS, or server-function changes. No change to what the club
  detail page shows or to who can see it.
