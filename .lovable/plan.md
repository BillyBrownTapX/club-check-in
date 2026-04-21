

## Why typing appears to delete itself

The preview is doing exactly what an aggressive auth guard tells it to do, and the result looks like disappearing text.

### What actually happens (from the session replay)

1. You open `/sign-up` (or `/sign-in`).
2. `AttendanceAuthProvider` starts hydrating the session from browser storage. This is async — it takes a beat.
3. The form renders immediately and you start typing (e.g. "Billy Brown", then "wabrow9730@un").
4. A valid session from an earlier test signup comes back from storage.
5. `useRequireGuestRedirect` sees "you're logged in, you shouldn't be on /sign-up" and calls the server function `getHostOnboardingState`, then navigates to `/events/$eventId`.
6. While you are mid-keystroke, the sign-up component unmounts. Your focused field keeps only its last character, and the other fields appear wiped — because the whole form is gone.
7. You land on `/events/9478bde7-…` with the impression that the inputs deleted your text.

This matches the replay exactly:

```text
type "wabrow9730@un"  → DOM elements removed
                      → input attributes re-set
                      → fullName + password appear cleared
                      → navigate to /events/9478…
```

No input is "losing" keystrokes. The route is being swapped out from underneath you by the guest redirect.

### Contributing noise
- `Warning: Error in route match: /sign-in/sign-in` — some `<Link to="/sign-in">` is resolving relative to the current `/sign-in` route and producing a bad path. Harmless, but clutters the console and sometimes cancels a navigation mid-flight.
- `Error during concurrent rendering but React was able to recover` — the symptom of a component unmounting while its children are suspending (the auth navigate fires during render).

## The fix

Stop redirecting away from the auth pages while the user is actively typing or while the session is still settling. Specifically:

1. Treat the sign-up form as the source of truth while focused. Do not auto-redirect away from `/sign-up` or `/sign-in` based on a cached session until:
   - auth is fully hydrated, AND
   - the user has not interacted with the form yet.

   If the user already started typing, keep them on the form. They get redirected on a successful submit instead of being yanked mid-keystroke.

2. Gate the form render behind `authLoading`. While the provider is still hydrating, show the form in a disabled/neutral state so the first keystroke cannot land before the redirect decision is made. This closes the race permanently.

3. Always make the Link to /sign-in absolute. Fix the `"/sign-in/sign-in"` warning by ensuring every `<Link to="/sign-in">` on auth routes is an absolute path (it is, but TanStack Router can treat it as relative when the current route is `/sign-in` — pass `from="/"` or use `navigate` to be explicit).

4. Clear the stale session cleanly when the user intentionally hits `/sign-up`. If they arrive with a valid session but explicitly requested the signup page, either:
   - redirect once on initial load (before the form is mountable), or
   - sign them out silently and let them create the new account.

   We will pick option (a): the redirect still runs, but only once on initial mount, before any keystroke is possible.

## Files that change

- `src/components/attendance-hq/host-management.tsx`
  - Update `useRequireGuestRedirect` to:
    - return `{ loading, shouldRedirect }` — consumers render a placeholder while loading or while the redirect is in flight
    - only fire `resolveRedirect` once, synchronously after hydration, and never after the user has touched the form

- `src/routes/sign-in.tsx`
  - While `loading` from the guard is true, render the `AuthCard` skeleton (heading + disabled inputs) instead of the live form. No keystrokes can land until the redirect decision is made.

- `src/routes/sign-up.tsx`
  - Same treatment as sign-in: render the card with disabled inputs until the guard resolves.

- `src/routes/forgot-password.tsx` and `src/routes/reset-password.tsx`
  - Same pattern, since they share `useRequireGuestRedirect` in spirit (forgot-password should not redirect an authed user mid-typing either). Audit and apply the same skeleton gate.

- Any `<Link to="/sign-in">` inside `/sign-in` should navigate absolutely to avoid the `/sign-in/sign-in` warning. Fix is scoped to the auth routes.

## What you will see after the fix

- Opening `/sign-up` with a cached session: you are redirected to `/events/…` before the form is interactive. No typing, no lost text.
- Opening `/sign-up` with no cached session: the form appears, and your typing stays put. No mid-keystroke redirect.
- Opening `/sign-in` while already logged in: same behavior — redirected before you can type.
- The `Error in route match: /sign-in/sign-in` warning disappears.
- The concurrent-rendering recovery warning disappears on auth routes.

## Out of scope

- No changes to the actual check-in form on `/check-in/$qrToken`. Its inputs are not affected by this bug; the replay evidence is specific to the auth routes and the guest guard.
- No changes to `useRequireHostRedirect` — it is already safe because the host screens do not have a form users type into before the redirect decision.
- No auth provider changes. The race is in the guest guard, not in `AttendanceAuthProvider`.

