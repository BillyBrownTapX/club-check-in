# Owner account: console-only, invisible to everyone else

Make `billy.brown@ingresssoftware.com` a pure administrative account: when that account signs in, the only thing it can see is the Owner console. Every other signed-in user behaves exactly as today and gets no hint that the console exists.

## What changes for the owner account

- Signing in lands directly on the Owner console (`/owner-admin`), not the host home screen.
- Any attempt to open a host screen (home, clubs, events, live, settings, onboarding, notifications, help) bounces straight back to the Owner console.
- The console header loses "Exit to app" and gains a "Sign out" action instead, so there is no path into the host experience.
- Public/marketing pages and the public student check-in pages stay reachable (they carry no host data), so shared links still work.

## What changes for everyone else

- The "Attendance HQ · Owner console" row is removed from Settings entirely, so no signed-in user ever sees the entry point — the owner reaches the console by landing there automatically.
- Non-owners hitting `/owner-admin/*` keep the current behavior: silent redirect to their normal experience, no data loaded, generic not-found errors from the server.

## Security model (unchanged, still server-enforced)

The authorization boundary stays where it already is and is not weakened by any of the UI work:

- Every owner server function runs `requireOwnerAdmin`, which reads the caller's authoritative email from the auth service using the service-role client and compares it to the configured owner email.
- The `owner_admin_*` SQL reporting functions remain revoked from `anon` and `authenticated`.
- Non-owner calls return a generic "Not found." response that reveals nothing about owner tooling.

## Technical notes

1. **Shared owner probe hook** — extract the existing `getOwnerAdminMe` query into a small `useOwnerAdminStatus()` hook (in `src/components/owner-admin/ui.tsx`) returning `{ isOwner, checking }` with a shared query key, `retry: false`, and a long `staleTime`. `useOwnerAdminGate` is refactored to consume it, so the probe is fetched once per session.
2. **Owner lockout of host routes** — in `useRequireHostRedirect` (`src/components/attendance-hq/host-management.tsx`), after the existing unauthenticated redirect, add: if the probe says owner, `navigate({ to: "/owner-admin", replace: true })` and report `loading: true` so host screens never render or fire host queries. Because every host route already calls this hook, the lockout is one change covering all of them.
3. **Post-auth landing** — `useResolvePostAuthRedirect` sends the owner to `/owner-admin` instead of `/home` (probe resolved before navigating; falls through to `/home` on probe failure, where the host gate then redirects). Same for `useRequireGuestRedirect` on `/sign-in` and `/sign-up`.
4. **Console shell** — replace the "Exit to app" link in `OwnerAdminShell` with a sign-out button that cancels/clears cached queries, signs out, and navigates to `/` with `replace: true`.
5. **Settings cleanup** — delete the owner-console section from `src/routes/settings.tsx` along with its now-unused `getOwnerAdminMe` probe and `Gauge` import.

## Verification

Sign in as the owner and confirm: landing is the console, direct navigation to `/home`, `/clubs`, `/events`, `/settings` all bounce back to the console, sign-out works. Then sign in as a normal host and confirm: normal app unchanged, no owner row in Settings, `/owner-admin` silently redirects to `/home` with no data loaded.
