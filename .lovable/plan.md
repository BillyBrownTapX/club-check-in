
Fix the clubs page reload loop by stabilizing the authorized server-function wrapper and keeping the clubs routes aligned with that stable API.

1. Root cause confirmed from code
- `src/routes/clubs.index.tsx` loads clubs inside a `useEffect` with `[getClubs, loading, user]` as dependencies.
- `src/routes/clubs.$clubId.tsx` does the same with `[clubId, getClub, loading, user]`.
- `getClubs` and `getClub` come from `useAuthorizedServerFn(...)` in `src/components/attendance-hq/auth-provider.tsx`.
- `useAuthorizedServerFn()` currently returns a new function on every render because the wrapper itself is not memoized.
- Each successful `setClubs(...)` / `setData(...)` causes a rerender, which creates a new `getClubs` / `getClub` function, which retriggers the effect, which fetches again. That matches the repeated club reloads shown in the session replay.

2. Primary fix
- Update `src/components/attendance-hq/auth-provider.tsx` so `useAuthorizedServerFn()` returns a stable callback using `useCallback`.
- Keep the current auth-expiry behavior, including:
  - fallback `supabase.auth.getSession()`
  - redirect to `/sign-in?reason=expired` for real expired sessions
- Ensure the returned function identity only changes when its true dependencies change, not on every render.

3. Clubs page alignment
- Keep `src/routes/clubs.index.tsx` using its existing effect-based load flow, but rely on the stabilized `getClubs` function so the effect runs only when auth state truly changes.
- Preserve current create-club behavior and refresh-after-create behavior.
- Optionally tighten the post-create refresh path so it uses one consistent reload routine instead of mixing router invalidation plus direct fetch.

4. Club detail page alignment
- Keep `src/routes/clubs.$clubId.tsx` using its current fetch pattern, but let the stabilized `getClub` and mutation wrappers stop the repeated reload behavior there too.
- Preserve the current template and event actions.
- Make sure the effect still reloads correctly when `clubId` changes.

5. Scope check for similar risk
- Review other management routes using `useAuthorizedServerFn()` inside `useEffect` dependency arrays, especially:
  - `src/routes/events.index.tsx`
  - `src/routes/events.new.tsx`
  - `src/routes/events.$eventId.tsx`
  - onboarding routes
- Apply only minimal consistency updates where needed; do not redesign their data flow if the stable hook fix already resolves the issue.

6. Files to update
- `src/components/attendance-hq/auth-provider.tsx`
  - memoize the returned authorized server-fn wrapper
- `src/routes/clubs.index.tsx`
  - minimal cleanup if needed after the hook stabilization
- `src/routes/clubs.$clubId.tsx`
  - minimal cleanup if needed after the hook stabilization
- Possibly a small follow-up in other route files that depend on the same hook pattern

7. Why this fix works
- The clubs page is not failing because the server data is missing; it is refetching repeatedly because the fetch function reference changes every render.
- Stabilizing the wrapper stops `useEffect` from interpreting every render as a dependency change.
- That preserves the existing architecture and fixes the issue at the shared source instead of patching each page separately.

8. Validation after implementation
- Open `/clubs`
  - confirm clubs load once and the page stops reloading
- Open `/clubs/$clubId`
  - confirm club detail loads once without repeated refreshes
- Create a club
  - confirm the new club appears without triggering a reload loop
- Navigate between clubs and events
  - confirm no repeated background reload pattern appears
- Verify auth expiry still works
  - real expired sessions should still redirect to `/sign-in?reason=expired`

9. Expected result
- The clubs page becomes stable and usable.
- Club detail pages stop continuously reloading.
- Shared auth-protected server calls remain secure and continue to handle true expired sessions correctly.
