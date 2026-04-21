
Fix the host management runtime failure by removing the dependency on the server-only admin client for authenticated host flows and standardizing all host-side data access on the authenticated middleware client that already has the bearer token and RLS context.

1. Root cause to fix
- The `/clubs` page calls `getHostClubSummaries`.
- `getHostClubSummaries` currently calls `getSupabaseAdmin()`, which imports `src/integrations/supabase/client.server.ts`.
- That file requires `SUPABASE_SERVICE_ROLE_KEY` at runtime.
- In this environment, the host management server functions are running without that server-role configuration, so the request crashes before returning UI data.
- The `[object Response]` error is the client surfacing a thrown server response/error without a friendly boundary message.

2. Correct architecture for this project
- Keep using `requireSupabaseAuth` for host-only server functions.
- For authenticated host reads and writes, use `context.supabase` from the middleware instead of the admin client.
- Reserve `client.server.ts` only for true privileged server operations that must bypass RLS.
- Since the database already has RLS policies for:
  - clubs
  - events
  - event_templates
  - attendance_records
  - host_profiles
  authenticated host management can run safely through the middleware client.

3. Refactor scope in `src/lib/attendance-hq.functions.ts`
- Replace admin-client usage in the host management section with the authenticated client from middleware:
  - `getHostClubSummaries`
  - `getHostTemplates`
  - `getHostEvents`
  - `getClubDetail`
  - `createClubManagement`
  - `updateClub`
  - `createEventTemplate`
  - `updateEventTemplate`
  - `duplicateEventTemplate`
  - `getEventFormPayload`
  - `createEvent`
  - `updateEvent`
  - `duplicateEvent`
  - `getEventOperations`
- Update helper functions so they accept a Supabase client parameter when used inside authenticated flows:
  - `getOwnedClubIds`
  - `requireOwnedClub`
  - `requireOwnedEvent`
- Use `context.supabase` for ownership-safe queries instead of re-querying through the admin client.

4. Keep privileged/admin-only operations separate
- Leave these flows on the admin client unless they are explicitly redesigned:
  - sign-up / user creation
  - auth admin user lookup
  - admin password reset/update paths
  - public check-in flows if they intentionally bypass RLS
  - bootstrap helpers like `ensureHostProfile` if they are used before a normal authenticated user query is available
- Do not mix privileged helpers into the clubs/events management path.

5. Implementation detail for ownership checks
- Refactor:
  - `requireOwnedClub(userId, clubId)`
  - `requireOwnedEvent(userId, eventId)`
- Into helpers shaped like:
  - `requireOwnedClub(supabase, userId, clubId)`
  - `requireOwnedEvent(supabase, userId, eventId)`
- Query through the authenticated client and keep explicit host ownership filters in addition to RLS where helpful for clear not-found behavior.

6. Remove dynamic admin dependency from `/clubs`
- Ensure `getHostClubSummaries` no longer imports or touches `getSupabaseAdmin()`.
- This is the immediate fix for the crash on the current `/clubs` route.
- Once this function is converted to `context.supabase`, the page should stop failing on first load.

7. Improve error handling so the UI does not show `[object Response]`
- In host management route components (`/clubs`, `/clubs/$clubId`, `/events`, `/events/new`, `/events/$eventId/edit`):
  - normalize caught values before rendering
  - if the thrown value is a `Response`, show a readable fallback like:
    - “Your session expired. Please sign in again.”
    - “You do not have access to this club.”
    - “Unable to load data right now.”
- Add a small shared helper in the management UI layer to extract a readable message from unknown thrown values.

8. Verify auth wrapper consistency
- Keep `useAuthorizedServerFn` in `src/components/attendance-hq/auth-provider.tsx`.
- Ensure every protected host route continues using that wrapper, not raw `useServerFn`.
- Confirm no management page still calls a middleware-protected server function without the authorization header.

9. Stabilize route UX after the backend fix
- For `/clubs`, `/events`, and `/clubs/$clubId`:
  - keep current client-side fetch-after-auth approach
  - preserve loading state until session exists
  - show readable error states instead of blank screens
- Do not reintroduce loader-based auth fetching for these routes.

10. Technical details
- Files to update:
  - `src/lib/attendance-hq.functions.ts`
  - optionally `src/components/attendance-hq/host-management.tsx` for a shared error-message helper
  - optionally affected route files if their catch blocks need normalization
- Do not edit:
  - `src/integrations/supabase/client.ts`
  - generated Supabase types/client files
  - `src/routeTree.gen.ts` manually
- No database migration is needed for this fix; the required RLS policies already exist.

11. Acceptance checks
- `/clubs` loads without throwing the missing environment variables error.
- `/events` and `/clubs/:clubId` also work without touching `client.server.ts`.
- Creating/editing clubs, events, and templates works through authenticated server functions.
- Unauthorized access still fails safely through RLS/ownership checks.
- Error UIs show human-readable messages instead of `[object Response]`.

12. Expected result
- The host management layer stops crashing because it no longer depends on unavailable server-role runtime variables.
- Authenticated clubs/events management uses the existing bearer-token middleware and database policies as intended.
- Navigation becomes stable and errors become readable instead of blank-screening.
