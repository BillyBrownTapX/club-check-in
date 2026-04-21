
Fix the false session-expired/logout race by making auth-page redirection wait for session hydration and by hardening protected server-fn invocation against a transient null auth context.

1. Root cause confirmed from code
- `src/routes/sign-in.tsx` calls `resolveRedirect()` immediately after `supabase.auth.signInWithPassword(...)` succeeds.
- `src/routes/sign-up.tsx` calls `resolveRedirect()` immediately after `supabase.auth.signUp(...)` returns a live session.
- `resolveRedirect()` in `src/components/attendance-hq/host-management.tsx` uses `useAuthorizedServerFn(getHostOnboardingState)`.
- `useAuthorizedServerFn()` in `src/components/attendance-hq/auth-provider.tsx` reads `session?.access_token` only from React auth context and treats missing context session as expired immediately.
- During fresh sign-in/sign-up, the auth context can still be hydrating even though auth already succeeded, which causes `signOut()` + redirect to `/sign-in?reason=expired`.

2. Primary fix: stop redirecting too early from auth pages
- Update `src/routes/sign-in.tsx`:
  - Remove the immediate `resolveRedirect(...)` call after successful sign-in.
  - Remove the now-unused `useResolvePostAuthRedirect` / `getManagementErrorMessage` imports tied only to that flow.
  - Add a small local pending state such as `authSettling` or `isFinishingSignIn`.
  - On successful sign-in, set the pending state and let `useRequireGuestRedirect()` handle the redirect after session hydration.
  - Disable the submit button while settling and change button copy to “Signing you in...” so the user is not left on a seemingly idle form.

- Update `src/routes/sign-up.tsx`:
  - Remove the immediate `resolveRedirect(...)` call when `data.session` exists.
  - Preserve the current no-session/email-confirmation path exactly as-is.
  - Add a local pending state such as `isFinishingSetup`.
  - When signup returns a live session, set the pending state and let `useRequireGuestRedirect()` perform the post-auth navigation after hydration.
  - Disable the submit button while settling and show a short status such as “Finishing setup...”.

3. Keep guest redirect as the single redirect source of truth
- Update `src/components/attendance-hq/host-management.tsx` in `useRequireGuestRedirect()`:
  - Keep the existing `loading || !user || !session` guard so redirects do not run while auth is unresolved.
  - Strengthen the derived readiness check to mirror `useRequireHostRedirect()` semantics:
    - treat `loading || (!!user && !session)` as still hydrating
    - only call `resolveRedirect()` once both `user` and `session` exist
  - Keep the `fired` ref so the redirect cannot race itself.
  - Preserve the current fallback behavior on server-probe failure; just do not misfire while auth is still settling.

4. Secondary hardening in authorized server calls
- Update `src/components/attendance-hq/auth-provider.tsx` in `useAuthorizedServerFn()`:
  - Keep real 401 handling unchanged.
  - Add a fallback path when context `session?.access_token` is missing:
    - call `supabase.auth.getSession()`
    - if a fresh session exists, use that access token instead of immediately forcing logout
    - only call `handleAuthExpired()` if both context session and fresh session are absent
  - Implement this without rebuilding the hook architecture:
    - make the returned function async-compatible
    - resolve the token first, then invoke the server fn with the bearer header
  - Keep the existing dedupe behavior with `expiredRef` so simultaneous failures still redirect only once.

5. File-by-file implementation breakdown
- `src/routes/sign-in.tsx`
  - Remove eager post-auth redirect call.
  - Add local “auth settling” UI state.
  - Let `useRequireGuestRedirect()` move authenticated users once hydration is complete.

- `src/routes/sign-up.tsx`
  - Remove eager post-auth redirect call only for the live-session path.
  - Keep email-confirmation notice behavior unchanged when no session is returned.
  - Add local “finishing setup” UI state and rely on `useRequireGuestRedirect()`.

- `src/components/attendance-hq/host-management.tsx`
  - Make `useRequireGuestRedirect()` explicitly hydration-safe and the canonical redirect path for auth pages.

- `src/components/attendance-hq/auth-provider.tsx`
  - Harden `useAuthorizedServerFn()` with a `supabase.auth.getSession()` fallback before treating the session as expired.

6. Why this fix works
- It removes the race-triggering protected server call from the exact moment immediately after sign-in/sign-up success.
- It lets the existing auth provider finish hydrating the fresh session before any protected onboarding lookup runs.
- It preserves the current onboarding routing logic because `useResolvePostAuthRedirect()` still decides the destination; it just runs at the correct time.
- It preserves real expired-session behavior because true missing sessions and true 401s still flow through `handleAuthExpired()`.

7. Remaining follow-up risk
- Low risk: the main remaining sensitivity is any other code path that invokes `useAuthorizedServerFn()` during a fresh auth transition outside the sign-in/sign-up pages.
- The hardening in `useAuthorizedServerFn()` reduces this risk significantly without changing the broader auth architecture.

8. Manual validation steps
- Sign in with valid credentials:
  - confirm no immediate logout request fires
  - confirm no false “Your session expired” banner appears
  - confirm redirect lands in `/onboarding/club`, `/onboarding/event`, or the correct event/workspace route

- Sign up with a flow that returns a live session:
  - confirm no bounce back to `/sign-in?reason=expired`
  - confirm redirect proceeds correctly after hydration

- Sign up with email confirmation enabled:
  - confirm the existing “Check your inbox...” notice still appears
  - confirm no redirect is attempted before confirmation

- True expiry test:
  - invalidate or remove the session
  - trigger a protected page/server function
  - confirm the user is signed out and redirected to `/sign-in?reason=expired`
  - confirm the expired-session banner appears only in this real-expiry case

9. Expected result
- Fresh sign-in and fresh sign-up stop causing immediate logout.
- Authenticated users are redirected only after session hydration is ready.
- Onboarding-state routing remains intact.
- Genuine expired sessions still sign out and redirect correctly.
