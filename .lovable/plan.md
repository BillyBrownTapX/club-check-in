
# Campus-Ready Launch Plan — Attendance HQ

Target tier: **campus-ready** (production-hardened + FERPA-adjacent posture + admin ops). Email/password auth only for now (no Google). Building it all now, sequenced so nothing blocks a launch.

## Phase 0 — Fix current build (blocks everything)

1. **`src/styles.css`**: remove the Google Fonts `@import url(...)` at line 1 (Lightning CSS reads it as a filesystem path and fails the build). Move fonts to root-route `<link>` tags in `src/routes/__root.tsx` (`preconnect` + `stylesheet` for Inter + Plus Jakarta Sans). Keep `@theme` `--font-sans` / `--font-display` unchanged.
2. **`src/routes/events.index.tsx`**: type the two `navigate({ search: (prev) => ... })` callbacks. Use `(prev: { clubId: string; status: string; query: string })` matching the route's `validateSearch` shape, so TS7006 clears.

Ship these first; nothing else builds without them.

## Phase 1 — Security must-fixes

1. **Lock down `SECURITY DEFINER` execute privileges** (new migration):
   - `REVOKE EXECUTE ... FROM public, anon` for every function in `public` schema.
   - `GRANT EXECUTE` only to `authenticated` for host-scoped helpers (`has_role`, `is_event_host`, `is_student_visible_to_host`).
   - Keep trigger-only functions (`handle_new_host_profile`, `sync_event_university_from_club`, `propagate_club_university_to_events`, `update_updated_at_column`) with no public execute — triggers run as table owner.
   - Re-run linter; the 12 WARNs should drop to 0.
2. **Enable HIBP leaked-password protection** via `supabase--configure_auth` (`password_hibp_enabled: true`).
3. **Rate-limit the public check-in surface**: add a lightweight per-IP+token counter table (`check_in_rate_limits`) with a 60s window on `lookupReturningStudent`, `checkInStudent`, `fastCheckIn`, `confirmReturningStudent`, and `rememberedDeviceCheckIn`. Wire through server fns. Return a friendly "slow down" error before hitting Supabase.
4. **QR token audit**: confirm tokens are ≥128 bits (from `crypto.randomBytes` or equivalent). Add "QR paused" state that rejects check-ins when `close early` was called (verify existing logic; patch if not enforced server-side).
5. **CSV export re-auth per page**: verify `is_event_host` check runs on every page cursor in `src/routes/api.host.events.$eventId.attendance[.]csv.ts`; add if missing.
6. **Run `security--run_security_scan`** and resolve criticals; update `@security-memory`.

## Phase 2 — Compliance & policy surface (campus/FERPA posture)

1. New public routes with unique head metadata:
   - `/privacy` — privacy policy (data collected: name, email, 900 number, device token; purposes; retention; deletion request path).
   - `/terms` — terms of service.
   - `/ferpa` — one-page data-handling posture ("Attendance HQ processes student directory data on behalf of the host club; hosts are the data owner. We store name, email, and 900 number solely to record attendance…").
   - `/support` — support contact + reporting a QR abuse.
2. Footer links to these on public routes (`index`, `home`, `sign-in`, `sign-up`, `check-in.$qrToken`, marketing pages).
3. Consent line on student check-in form: "By checking in you agree to share your name, email, and 900 number with the event host. See our Privacy Policy."
4. Reuse existing design tokens; do NOT introduce a bolted-on trust palette (per trust-page guidance).

## Phase 3 — Auth & account lifecycle (email-only)

1. **Email verification**: confirm signup path requires email confirmation; update sign-up UI to show a clear "Check your inbox" state after `signUp()`.
2. **Password reset UX**: verify `/reset-password` reads `type=recovery` hash and enforces `updateUser({ password })`; add regression note.
3. **Session-expiry UX**: interceptor around `useAuthorizedQuery/Mutation` — on 401, toast "Session expired" and `navigate({ to: "/sign-in" })` instead of raw error screen.
4. **Account deletion**: new server fn `deleteMyAccount` (auth'd) that:
   - Deletes host's clubs → cascade to events/attendance.
   - Deletes `host_profiles` row.
   - Calls `supabaseAdmin.auth.admin.deleteUser(context.userId)` (loaded inside handler with `await import`).
   - UI in `/settings` with confirm dialog.
5. **Data export**: `exportMyData` server fn returning JSON dump (host profile + clubs + events + attendance summaries — no other hosts' data). Download button in `/settings`.
6. **Auth email templates** via `email_domain--scaffold_auth_email_templates` for branded reset/verification (only if custom domain email is set up; check `email_domain--check_email_domain_status` first).

## Phase 4 — Data model & migrations

1. **Indexes migration**:
   - `attendance_records (event_id, student_id)` (unique already?), `(event_id, created_at desc)` for live feed.
   - `events (club_id, event_date desc)`.
   - `student_device_sessions (device_token)` unique.
   - `clubs (host_id)`.
2. **Soft delete on events**: add `deleted_at` column + policy update so `deleteEvent` sets `deleted_at` and list queries filter it out. Hard-delete stays available via admin-only path (Phase 6).
3. **Retention job**: `pg_cron`-triggered public route `/api/public/cron/retention` (HMAC-verified) that purges `student_device_sessions` older than 180 days and `attendance_actions` older than 2 years.
4. **CHECK-safe validation**: audit any existing CHECK constraints for time-dependent rules; convert to triggers.

## Phase 5 — Reliability & observability

1. **Sentry** (frontend + server fn error hook) — add DSN as secret; wire in `src/router.tsx` `defaultErrorComponent` and `src/lib/server-errors.ts`.
2. **Route boundaries audit**: every route with a loader has both `errorComponent` and `notFoundComponent`. Patch any missing.
3. **Realtime resume**: `use-event-realtime` — reconnect on `visibilitychange`, refetch on resume, backoff on error.
4. **CSV stream backpressure**: confirm loop `await`s writer, cancels on client abort signal.
5. **Structured logs**: replace `console.error("[server-error]", ...)` with a small logger that JSON-formats and includes request id.

## Phase 6 — Admin operations

1. Ensure `app_role` enum has `admin`; add seed instructions (SQL migration adds an admin via known email if provided; otherwise document).
2. New nested layout `src/routes/_authenticated/_admin/route.tsx` gated by `has_role('admin')`.
3. Admin pages:
   - `/admin` — dashboard (host count, active clubs, events last 30d).
   - `/admin/hosts` — list hosts, promote/demote, hard-delete.
   - `/admin/abuse` — flag/purge a QR token or event; audit log view (from `attendance_actions`).
4. All admin server fns verify `has_role(userId, 'admin')` before touching `supabaseAdmin`.

## Phase 7 — Performance

1. **Code-split** `host-management.tsx` (1275 LOC): extract `EventForm`, `ClubForm`, `TemplateForm` into their own files; route files import only what they render.
2. **Split** `attendance-hq.functions.ts` (1544 LOC) by domain: `clubs.functions.ts`, `events.functions.ts`, `attendance.functions.ts`, `students.functions.ts`, `templates.functions.ts`. Keep call sites unchanged via barrel re-export during migration.
3. **Query staleTime tuning**: bump list queries to `staleTime: 30_000`, event detail to `10_000`. Keep live attendance at `0` (realtime pushes).

## Phase 8 — QA, docs, marketing

1. **Playwright smoke suite** (`tests/e2e/`): sign-in, create club, create event, student new check-in, returning check-in, CSV export, account deletion. Wire into `bunx playwright test`.
2. **README**: local setup, env vars, migrations, deploy, admin bootstrap.
3. **RUNBOOK.md**: key rotation, pause/resume Cloud, restore, abuse response, retention job monitoring.
4. **Landing page audit** (`home.tsx`): title, description, OG image (build a hero and set it in leaf `head()`), JSON-LD `SoftwareApplication`.
5. **`public/robots.txt`** + **`public/sitemap.xml`** for public routes only.

## Technical notes

- New migrations go through the migration tool; every new public table gets `GRANT` statements immediately after `CREATE TABLE`.
- No new deps needed for Phase 0–4 except Sentry SDK in Phase 5 and Playwright in Phase 8.
- Rate limit table policy is auth-agnostic (public write via server fn using service role loaded inside handler; not exposed to Data API).
- Trust pages follow the trust-page guidance: app-owned copy, no "verified by Lovable", no certification claims. FERPA page is a posture statement, not a compliance claim.

## Sequencing

Phase 0 must ship first (build broken). Phases 1 → 2 → 3 → 4 in order (each depends on the prior for policy or schema changes). Phases 5, 6, 7, 8 can parallelize afterward. Total scope is large; I'll ship phase by phase and pause between phases for a smoke check.

## Out of scope

- Google/social auth (per your direction — email only).
- Native mobile wrap / Capacitor.
- Marketing email or newsletter.
- Multi-tenant billing.

## Confirm before I start

Proceed with Phase 0 immediately after approval, then Phase 1?
