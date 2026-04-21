
Stabilize navigation by fixing the management layer’s routing model, eliminating full-page reload paths, and restoring missing route coverage so the host UI behaves consistently on click, refresh, and direct entry.

1. Fix the root navigation architecture
- Replace every host-side full reload path with TanStack navigation:
  - remove raw `<a href="/events/new">`, `<a href="/events?...">`, and templated `href={`/events/...`}` usages
  - replace `window.location.href = state.nextPath` with `navigate({ to: ... })` or route-aware redirects
  - replace `window.history.back()` cancel behavior with explicit route targets
- Keep all host navigation inside the router so auth/session state is preserved and SSR hydration is not interrupted.

2. Add the missing management routes immediately
- Create the currently referenced but missing routes:
  - `/events/new`
  - `/events/$eventId/edit`
- These routes are already linked from:
  - host shell quick action
  - clubs page cards
  - club detail actions
  - events list actions
  - event cards
  - template “Use” actions
- Build them around the existing `EventForm` and `getEventFormPayload` / `createEvent` / `updateEvent` / `duplicateEvent` server functions so the existing UI wiring becomes real instead of dead-ending into 404s.

3. Remove the current SSR auth mismatch on protected management routes
- The biggest source of broken navigation is that `/clubs`, `/events`, and `/clubs/$clubId` use route loaders that call server functions guarded by `requireSupabaseAuth`, but auth only exists client-side after hydration.
- Refactor protected host management routes so they do not depend on SSR loader auth headers before the user session is available.
- Use one of these stable patterns consistently:
  - preferred: client-side data fetching after auth is confirmed in the component
  - or: a proper route-context auth guard system that can authenticate before loaders run
- For this codebase, the lowest-risk stabilization path is:
  - keep `useRequireHostRedirect`
  - move management data fetching from route loaders into authenticated components using `useServerFn`
  - show clean loading states while fetching
- This avoids unauthorized loader failures on refresh/direct entry and removes the “broken page before redirect” behavior.

4. Rebuild `/clubs` around authenticated client fetch
- Remove the loader from `src/routes/clubs.index.tsx`.
- After auth resolves:
  - fetch club summaries with the server function
  - render loading, empty, success, and error states inside the page shell
- Keep create-club dialog behavior, but refresh data via refetch/invalidate only after successful mutation.

5. Rebuild `/clubs/$clubId` around authenticated client fetch
- Remove the loader from `src/routes/clubs.$clubId.tsx`.
- After auth resolves:
  - fetch the club detail payload for the current `clubId`
  - handle not-found and unauthorized states inside the route component
- Keep template actions and club editing, but make all follow-up refreshes use one consistent refetch path.

6. Rebuild `/events` around authenticated client fetch
- Remove the protected loader dependency from `src/routes/events.index.tsx`.
- Keep `validateSearch` for clean URL-driven filters, but fetch events/clubs after auth is ready.
- Preserve filter/search state in the URL using TanStack navigate updates, not reloads.
- Keep empty states for:
  - no events
  - no filter matches

7. Implement `/events/new`
- Add route metadata and route-local error handling.
- Support prefill sources already implied by existing code:
  - `clubId`
  - `templateId`
  - `duplicateFrom`
- Load event form payload after auth resolves.
- Use `EventForm` for UI, but improve the form so:
  - check-in open/close values are derived from date/start-time changes
  - date/time inputs are touch-friendly
  - submit routes to `/events/$eventId` after create/duplicate
- If `duplicateFrom` is present, submit through `duplicateEvent`; otherwise use `createEvent`.

8. Implement `/events/$eventId/edit`
- Add route metadata and ownership-safe loading.
- Use `getEventFormPayload({ eventId })` to prefill the form.
- Submit via `updateEvent`.
- After save, route to `/events/$eventId`.
- Replace generic cancel/back behavior with an explicit link to the event detail page.

9. Tighten onboarding/auth redirect behavior
- Replace `window.location.href = state.nextPath` in:
  - sign-in
  - sign-up
  - reset-password
- Route based on onboarding status using TanStack navigation.
- Keep current onboarding logic, but make it deterministic:
  - complete + event -> `/events/$eventId`
  - needs club -> `/onboarding/club`
  - needs event -> `/onboarding/event`
- This will reduce hard reloads and avoid re-triggering broken protected SSR paths.

10. Clean up host shell and management actions
- Ensure every action button uses typed router links/navigation.
- Replace remaining anchor-based host actions with `<Link>` or `navigate`.
- Keep mobile quick actions working, especially the `/events/new` button in the host shell.

11. Strengthen loading and boundary behavior
- Add explicit loading placeholders/skeletons for authenticated management pages while:
  - auth is resolving
  - page data is fetching
- Keep route-level `errorComponent` / `notFoundComponent` where useful, but avoid relying on protected loaders that fail before auth.
- Prevent blank/null screens by rendering lightweight loading UI instead of returning `null` for long-running states.

12. Fix secondary UX traps contributing to “problems left and right”
- Replace free-text check-in timestamp inputs in the management event form with clearer date/time presentation or derived hidden values.
- Ensure template “Use” actions land on the new event route with real prefill behavior.
- Ensure duplicate buttons create a new event flow instead of linking into missing pages.
- Make cancel/back actions deterministic so users never land on a 404 or browser-history dead end.

13. Acceptance checks for the stabilization pass
- Signed-in host can:
  - open `/clubs`
  - refresh `/clubs`
  - open `/clubs/:clubId`
  - refresh `/clubs/:clubId`
  - open `/events`
  - refresh `/events`
  - open `/events/new`
  - open `/events/:eventId/edit`
- From Clubs and Events pages:
  - all Create Event buttons work
  - all Manage/Edit links work
  - duplicate actions work
  - template Use/Edit/Duplicate actions work
- Auth/onboarding:
  - sign-in and sign-up redirects stay in-app without hard reloads
  - reset-password completion routes correctly
- No host navigation path should depend on a missing route or force a full reload into a protected SSR loader.

14. Technical details to apply during implementation
- Do not edit `routeTree.gen.ts`; let route generation update automatically from real route files.
- Reuse existing components and server functions wherever possible:
  - `EventForm`
  - `ClubDialog`
  - `TemplateDialog`
  - `getEventFormPayload`
  - `createEvent`
  - `updateEvent`
  - `duplicateEvent`
- Prefer typed TanStack `<Link>` and `useNavigate`.
- Keep ownership checks server-side exactly where they already exist; only change when/how the client calls them.

15. Expected result
- The host management area becomes reliable instead of brittle:
  - no more dead links to missing routes
  - no more full reloads breaking protected navigation
  - no more refresh/direct-entry failures on `/clubs` and `/events`
  - create/edit/duplicate/template flows become complete and navigable
- The app should feel like one coherent host workspace instead of a mix of working screens and broken transitions.
