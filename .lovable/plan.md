# Owner Admin Dashboard for Attendance HQ

A separate, internal operations dashboard for the application owner only
(billy.brown@ingresssoftware.com), built on top of the existing app — no
rewrites, no breaking schema changes, no revenue/billing anything.

## What I confirmed in the current app first

- Auth is Lovable Cloud (Supabase). Server logic already runs through
  `createServerFn` + `requireSupabaseAuth`; there is already a campus-staff
  admin console at `/admin` gated by the `admin` role in `user_roles`. The new
  Owner Admin is a **separate, stricter** area and leaves `/admin` untouched.
- The owner account already exists in the auth system, so the gate can be
  wired and tested immediately.
- Real data exists to compute against today: 27 accounts, 4 clubs, 20 events,
  52 check-ins, 38 students.
- "Organization" in this app = **club**. Clubs belong to a university and have
  owner/officer membership rows, event templates, events, pre-check-ins,
  attendance records, and a `host_activity` milestone feed.

### Metrics that can be computed from existing data
Organizations/clubs, members (students per university/club attendance), events,
check-ins (lifetime + any date range), active orgs 7D/30D by real check-in
activity, monthly North Star check-ins with prior-month comparison, activation
funnel stages, retention/cohorts, health score, admins per club, pre-check-in
conversion, last activity + days since, account creation and last sign-in.

### Metrics that do NOT exist yet (and how they're handled)
- Organization type, institution beyond university, city/state → **not shown**
  until those fields exist. I'll flag them as unavailable rather than invent columns.
- Failed logins, API/DB errors, response times, QR scan failures, duplicate and
  failed check-in attempts → no telemetry table today. Phase 3 adds a minimal
  `analytics_events` table and starts tracking forward; System Health will
  clearly label metrics as "tracked since <date>" and show "not instrumented"
  for anything still uncollected. No fabricated numbers.
- Feature usage (exports, reports viewed, manual check-in, member search) →
  same: instrumented forward via `analytics_events`.

## Security (highest priority)

1. Database: a `is_owner_admin()` security-definer SQL function that returns
   true only when the authenticated user's email matches the owner email
   exactly (case-insensitive), read from `auth.users` inside the function.
2. Server: a reusable `requireOwnerAdmin` middleware/helper used by **every**
   owner-admin server function. It verifies the session, then verifies the
   owner check server-side. Non-owners get a generic 403 with no hint that
   owner tooling exists.
3. Aggregation queries run through security-definer SQL functions or the
   service-role client only **after** the owner check passes. Service-role
   credentials never reach the browser.
4. Routes: `/owner-admin/*` lives under a gated layout that silently redirects
   non-owners to `/home`, plus `noindex, nofollow`. The redirect is convenience
   only — data access is blocked server-side regardless.
5. Entry point: an "Owner Admin" item appears in the account menu only for the
   owner account.
6. I'll test with a non-owner account and by calling an owner-admin endpoint
   directly without the owner session.

## Pages

Navigation: Overview, Organizations, Users, Members, Events, Attendance,
Activation, Retention, Product Usage, System Health.

- **Overview** — North Star (Monthly Successful Check-Ins, current vs previous
  month, % change, trend) plus KPI groups for organizations, members, events,
  attendance, engagement; charts for organization growth, check-in volume
  (day/week/month), event creation, member growth, active organizations.
- **Organizations** — searchable, sortable, server-paginated table with member/
  event/check-in totals, 30-day activity, last activity, days since, health
  score, status (Power User / Healthy / At Risk / Churning / Dormant / Never
  Activated). Filters for status, created date, university, activity level.
- **Organization detail** — full profile: info, administrators (owner +
  officers), membership, events, attendance, engagement/health, and an activity
  timeline built from real records (created, events, check-ins, milestones,
  officer changes).
- **Users** — registered hosts, new today/week/month, active users, admins per
  club, users with no club, clubs created but never used; table with role,
  created, last sign-in, events created.
- **Members** — platform-wide student membership metrics and a table of events
  attended, total check-ins, first/last attendance. Owner-only visibility;
  existing privacy rules stay in force everywhere else.
- **Events** — totals by period, averages, median attendance, zero-attendance
  events, largest event, most active org; filterable table.
- **Attendance** — deep check-in analytics: over time, by day of week, by hour
  of day, top organizations, largest events, with date-range control.
- **Activation** — funnel (account → club → members → first event → first
  check-in → second event) with counts, %, drop-off, average time between
  stages, plus Never Activated and Activation Stalled lists.
- **Retention** — organization retention at 7/30/60/90 days based on real
  check-in activity, reactivated/dormant/at-risk counts, average days between
  events, monthly cohort retention grid.
- **Product Usage** — adoption per real feature (clubs, events, QR check-in,
  pre-event check-in, templates, semester reports, CSV export, officer invites,
  purge tools), each with total uses, orgs using, % of orgs, 7D/30D and trend.
  Only features that actually exist; extensible registry for new ones.
- **System Health** — what's measurable now, with explicit "not instrumented
  yet" labels for the rest.

Health score: 30% recent activity, 25% event frequency, 20% check-in volume,
15% administrator engagement, 10% feature adoption — weights kept in one
config constant so they can be tuned later.

## Design

Reuses the existing Attendance HQ design system and shell components (cards,
tiles, segmented controls, existing chart primitives). Executive-feeling
layout: one clear hierarchy per page, restrained chart count, status pills,
tooltips on derived metrics, responsive from mobile to desktop.

## Technical approach

- New `supabase/migrations` entry: `is_owner_admin()` plus a set of
  security-definer aggregate functions (organization rollups, daily check-in
  series, activation funnel, cohort retention) and supporting indexes so the
  dashboard never scans raw tables from the browser.
- New `src/lib/owner-admin.functions.ts` (server fns, all owner-gated) and
  `src/lib/owner-admin-schemas.ts` (zod input validation, pagination/sorting/
  filter params).
- New routes: `src/routes/owner-admin.tsx` (gated layout with nav) and one leaf
  per page, plus `owner-admin.organizations.$clubId.tsx`.
- All list endpoints paginate and filter server-side; date range is a shared
  URL search param so links are shareable and charts/KPIs stay in sync.

## Phasing

1. **Foundation** — owner authorization, routes/shell, Overview, Organizations,
   Organization detail, Users, Members, Events, Attendance.
2. **Intelligence** — Activation funnel, health score, retention, cohorts,
   at-risk/dormant lists.
3. **Product intelligence** — `analytics_events` tracking, Product Usage,
   System Health, enhanced trends.

I'll build Phase 1 first and confirm the security gate works before moving on.
Existing host, check-in, and marketing functionality stays exactly as is.
