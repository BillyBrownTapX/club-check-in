

## Tier 1 #2/#3 — TanStack Query migration + route boundaries

### Why this is the right next move

Today every host route runs the same pattern: `useState` + `useEffect` + a `cancelled` flag, calling `useAuthorizedServerFn(...)` directly. That means:

- Navigating Home → Events → Event Detail → back to Home **refetches everything every time** (no shared cache).
- The realtime hook we just shipped manually re-invokes the fetcher; it can't deduplicate or coalesce with other consumers.
- Mutations (create club, delete event, manual check-in) optimistically update local `useState` arrays per-route, so a delete on `/clubs/$clubId` doesn't reflect on `/home` until you reload.
- 13 of 19 routes have no `errorComponent` and 17 of 19 have no `notFoundComponent`. A failed fetch bubbles to the global root error UI.

### Important constraint we discovered

`useAuthorizedServerFn` reads the **client-side Supabase session** to attach a bearer token. Route `loader`s run during navigation without React context, so they cannot call authorized server fns. **Conclusion: we don't move to loader-based prefetch for authenticated routes.** Instead we use TanStack Query *inside components* (with `useQuery`/`useSuspenseQuery` patterns wired through a small `useAuthorizedQuery` helper). Loaders are still added — but only for the **public** `/check-in/$qrToken` route and for **error/notFound boundaries**, which is all we actually need to fix the 13/17 boundary gap.

### What ships in this turn

**1. New helper: `useAuthorizedQuery` / `useAuthorizedMutation`** in `src/components/attendance-hq/auth-provider.tsx`.

Thin wrappers around `useQuery`/`useMutation` that:
- Take a server fn + payload and produce a stable query key derived from the fn's `.url` (already present on TanStack Start server fns) + payload.
- Internally use `useAuthorizedServerFn` to call the fn, so 401-redirect logic stays centralized.
- Gate `enabled` on `!loading && !!user` so we never fire while auth is hydrating.
- For mutations, expose a small invalidation helper: `invalidate(['events'])`, `invalidate(['clubs'])`, etc.

This gives us one consistent migration path; no per-route `queryOptions(...)` boilerplate to maintain.

**2. Centralized query keys** in a new `src/lib/query-keys.ts`:

```text
queryKeys = {
  clubs: { all, summaries, detail(clubId) },
  events: { all, list(filter), detail(eventId) },
  universities: { all },
  templates: { byClub(clubId) },
}
```

Lets mutations invalidate by prefix (`['events']` invalidates list + detail).

**3. Migrate read paths on these routes** (one PR-equivalent batch):

- `home.tsx` — clubs + events become two `useAuthorizedQuery` calls. Filtering / featured-event memos stay.
- `clubs.index.tsx` — clubs query.
- `clubs.$clubId.tsx` — club detail query.
- `events.index.tsx` — events list query keyed on the filter.
- `events.$eventId.tsx` — event operations query; **`useEventRealtime` is rewired to call `queryClient.invalidateQueries(eventDetail(eventId))`** instead of poking local state. This makes realtime + cache + manual refresh share one source of truth.
- `events.$eventId.display.tsx` — same pattern; the projector display also benefits from invalidate-on-realtime.
- `notifications.tsx` — events query (reuses the same cached payload as Home / Events list — instant).

**4. Migrate write paths** to `useMutation` with `onSuccess: invalidateQueries(prefix)`. Touched on:

- `clubs.index.tsx` (create club → invalidate `['clubs']`).
- `clubs.$clubId.tsx` (update/delete club, create/update/duplicate template, delete event → invalidate `['clubs', clubId]` + `['events']`).
- `events.index.tsx` (delete event → invalidate `['events']`).
- `events.$eventId.tsx` (manual check-in, remove/restore attendance, close early, archive, duplicate, export → invalidate `['events', eventId]`; realtime will pile on too, which is harmless because Query dedupes).

**5. Per-route boundaries (the #3 half).**

For every route migrated above, add:
- `errorComponent` — small ios-card with the error message and a "Try again" button that calls `router.invalidate()`. Reuses the existing `ManagementPageShell` for chrome.
- `notFoundComponent` (only where applicable: `clubs.$clubId`, `events.$eventId`, `events.$eventId.edit`, `events.$eventId.display`) — "This club/event no longer exists" + link back.

The auth-gated routes do **not** get loaders (per the constraint above). `notFound()` is thrown inside the query's `queryFn` when the server returns the existing "not found" sentinel; the route's `notFoundComponent` catches it via the standard React error boundary forwarding pattern (we throw `notFound()` from the component on first render when `data === null`).

**6. One loader where it actually pays off.**

`/check-in/$qrToken` is **public** (no bearer token needed). Convert it to use a route `loader` calling the existing public server fn, plus an `errorComponent` and `notFoundComponent`. Faster first paint for students scanning a QR is the highest-leverage UX win we can ship from this batch.

### What's intentionally NOT in this batch

- No migration of the **auth/onboarding routes** (`sign-in`, `sign-up`, `forgot-password`, `reset-password`, `onboarding.club`, `onboarding.event`). They submit forms; they have no list-fetch problem to solve. Adding `errorComponent` boundaries to these is the only follow-up they need and we'll fold it into the next pass.
- No `useSuspenseQuery` + Suspense boundaries. Every route already renders its own `Loading…` placeholder; converting to suspense would mean adding suspense fallbacks at the route level and is purely cosmetic. We use plain `useQuery` to keep the visual loading behaviour identical.
- No changes to server fns, schemas, RLS, the realtime migration we just shipped, or the ios shell.

### Behavior after this ships

- Home → Events → Event Detail → back to Home is **instant on the way back** (cached).
- Manual check-in on event detail → realtime fires → query invalidates → roster + counters re-render in under a second; no double-fetch flash because Query dedupes.
- Failed network on `/clubs/abc` shows a small inline error card with a Retry button instead of the full-page red error UI.
- Deleted event opened from a stale link shows "This event no longer exists" with a link back to Events.
- Public student check-in route renders its first paint from the loader; no client-side loading flash.

### Files touched

- New: `src/lib/query-keys.ts`, helpers added to `src/components/attendance-hq/auth-provider.tsx`.
- Edited: `src/routes/home.tsx`, `clubs.index.tsx`, `clubs.$clubId.tsx`, `events.index.tsx`, `events.$eventId.tsx`, `events.$eventId.display.tsx`, `notifications.tsx`, `check-in.$qrToken.tsx`.
- Edited: `src/hooks/use-event-realtime.ts` — `onChange` callback signature stays the same; routes will pass `() => queryClient.invalidateQueries(...)`.

### Risk + mitigation

- **Risk**: One of the migrated routes silently regresses because of a bad query key. **Mitigation**: keep the query key registry centralized; mutations invalidate by prefix so a typo in a leaf key still triggers a parent refetch.
- **Risk**: Visible behavior change from query caching (e.g., user sees stale data for a second). **Mitigation**: set `staleTime: 0` on event detail / display (already realtime-driven) and `staleTime: 30_000` on list pages. Matches today's perceived freshness.
- **Risk**: Auth race — a query fires before the session hydrates. **Mitigation**: `useAuthorizedQuery` reads `loading` from `useAttendanceAuth` and forces `enabled = false` until ready. Same gate the current `useEffect`s already use.

