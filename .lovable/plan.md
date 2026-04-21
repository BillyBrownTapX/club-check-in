

## Send everyone to `/home` after logging in

Right now, after a successful sign-in / sign-up / password reset, the app asks the server "where is this host in the onboarding flow?" and lands them on `/onboarding/club`, `/onboarding/event`, or `/events/:id` depending on the answer. You want all of those to land on `/home` instead.

### What changes

**One helper, one behavior.** `useResolvePostAuthRedirect` in `src/components/attendance-hq/host-management.tsx` is the single place that decides where a freshly-authenticated host goes. I'll replace its body so it always navigates to `/home` — no server probe, no branching on onboarding state.

This automatically fixes all three entry points that call it:
- `/sign-in` (via `useRequireGuestRedirect`) → `/home`
- `/sign-up` (via `useRequireGuestRedirect`) → `/home`
- `/reset-password` (after successful password update) → `/home`

And because an already-logged-in user visiting `/sign-in` or `/sign-up` also goes through this same helper, they'll be bounced to `/home` too (previously they'd be bounced to wherever onboarding said).

### Why this is safe

- `/home` (`src/routes/home.tsx`) uses `useRequireHostRedirect`, which only checks "is there a session?" — it does not force users back into onboarding. So brand-new signups with no club yet will land on `/home` cleanly and can create a club from there via the existing "New Club" action on that screen.
- The onboarding routes (`/onboarding/club`, `/onboarding/event`) still exist and still work if a user navigates to them directly — we're just no longer auto-routing into them.
- The existing `getHostOnboardingState` server function stays in place; it's still used elsewhere and no server code needs to change.

### Files touched

- `src/components/attendance-hq/host-management.tsx` — simplify `useResolvePostAuthRedirect` to always `navigate({ to: "/home" })`. Drop the unused `fetchOnboardingState` call inside that hook (other callers of `getHostOnboardingState` are unaffected).

### Out of scope

- No changes to `/home`'s content or the empty-state for users with no clubs yet.
- No changes to the onboarding routes themselves.
- No changes to sign-in / sign-up / reset-password UI — only their post-success destination changes, and that's handled through the shared helper.

