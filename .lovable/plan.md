

## Goal

Stop hiding the real error and stop the root error/404 boundaries from crashing themselves.

## Root cause

The "useAttendanceAuth must be used within AttendanceAuthProvider" message the user sees is a **secondary crash**, not the actual problem.

What's happening:
1. Some underlying error (or 404) occurs in a route.
2. The error bubbles up to the root-level fallback in `src/routes/__root.tsx` (`RootErrorComponent` or `NotFoundComponent`).
3. Those root fallbacks render `<AttendanceLogo />`. `AttendanceLogo` calls `useAttendanceAuth()` because of the logo upload flow.
4. Root-level `errorComponent` / `notFoundComponent` render OUTSIDE `RootComponent`, which is where `<AttendanceAuthProvider>` lives. The context is missing, so `AttendanceLogo` throws.
5. That secondary crash replaces the original error in the overlay, so every page (sign-in, /events, event detail) ends up showing the auth-provider message instead of the real cause.

There's a parallel masking problem in `src/router.tsx`'s `DefaultErrorComponent`: the error message is wrapped in `import.meta.env.DEV`, so in the deployed preview the user sees only "Something went wrong" with no diagnostics.

## Fix

1. **Make root fallbacks provider-independent** in `src/routes/__root.tsx`.
   - Replace `<AttendanceLogo />` inside `RootErrorComponent` and `NotFoundComponent` with a static, auth-free brand mark (simple text/wordmark "Attendance HQ" using `font-display`, no context, no Supabase calls).
   - Keep the existing layout, copy, and CTAs.

2. **Surface the underlying error** in `src/router.tsx`'s `DefaultErrorComponent`.
   - Always render the error message (drop the `import.meta.env.DEV` gate) inside the existing `<pre>` so we can actually diagnose route-level crashes in preview/production.
   - Also log it to `console.error` for the network/console panels.

3. **Defensive logging in `__root.tsx`'s `RootErrorComponent`** so that if it ever fires again we get the original error printed in the console with a clear `[root-error]` tag (already partially present — confirm it stays and add the error stack).

4. **Confirm the underlying error after the masking is removed.** Once the auth-context crash stops happening, the next reload of `/events`, `/sign-in`, and `/events/$eventId` will show the real error message in the overlay. Based on the server logs (clubs row coming back with `university_id: null` and `universities: null` for the Sales Club), the most likely real failure is a downstream renderer assuming `event.clubs.universities` exists. After the fallback fix lands, address whichever real error appears (expected: harden the events screens against null `universities` / `university_id` from legacy clubs that haven't been backfilled).

## Files touched

- `src/routes/__root.tsx` — swap AttendanceLogo in `RootErrorComponent` and `NotFoundComponent` for a static wordmark; keep error logging.
- `src/router.tsx` — always render the error message in `DefaultErrorComponent`; add `console.error`.

## Out of scope for this pass

No design changes, no schema changes, no auth changes. This is strictly an error-handling / observability fix so the actual bug becomes visible. The follow-up (likely: null-safe rendering when a club hasn't been linked to a university yet) will be handled in a separate pass once the real error is unmasked.

