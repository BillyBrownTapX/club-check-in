

## Attendance HQ — Launch Readiness Plan

A grounded, project-specific roadmap to get this app rock-solid for full launch. Organized by impact tier so you can ship the high-leverage items first.

### Where the app already stands (so we don't redo it)

- RLS is enabled on every table; ownership helpers (`is_event_host`, `is_student_visible_to_host`) close cross-tenant gaps.
- Auth middleware (`requireSupabaseAuth`) returns sanitized 401s and never leaks reasons.
- Server errors funnel through `safeMessage` / `normalizeSupabaseAuthError` so raw Postgres / Supabase strings never reach users.
- Public check-in flow has been hardened (no UUID echo-back, identity re-proven server-side).
- Indexes exist on the hot keys (`qr_token`, `event_id`, `student_id`, `nine_hundred_number`, `host_id`, `university_id`, plus the unique `(event_id, student_id)` on attendance).
- Recent UI pass standardized iOS shell, sticky CTAs, error summaries on the two main forms.

The remaining work is **scale, reliability, observability, and PWA polish** — not architecture.

---

### Tier 1 — Must-fix before launch (correctness & cost)

**1. Replace 3-5s polling with Supabase Realtime on event detail + display + live.**
Today `events.$eventId.tsx` polls `getEventOperations` every 5s and `events.$eventId.display.tsx` polls every 3s. With 50 hosts viewing live events, that's ~1k requests/min hitting the database — each one re-running `requireOwnedEvent` + two SELECTs + a 30-row action fetch. Switch to:
- `ALTER PUBLICATION supabase_realtime ADD TABLE attendance_records, attendance_actions, events;`
- One channel per event subscribing to `event_id=eq.{id}` filter.
- Keep a 30s safety-net poll only when realtime is disconnected (use channel state).
- Drop `POLL_INTERVAL_MS` from 5000 → 30000 as the fallback.

**2. Migrate the 18 stateful screens to TanStack Query.**
Every route uses `useState + useEffect + cancelled flag` to fetch. That re-fetches on every mount, has no dedup, no stale-while-revalidate, no shared cache between Home / Clubs / Events. Wrap server fns in `queryOptions(...)` and:
- Use `useSuspenseQuery` in route components.
- Use `queryClient.ensureQueryData` in route `loader`s for instant paint.
- Use `useMutation` with `onSuccess: invalidateQueries(['event', id])` for write paths.
- Result: Home → Events → Event Detail navigation becomes instant; the polling loop becomes `refetchInterval` on a single subscription.

**3. Add route loaders + per-route `errorComponent` / `notFoundComponent`.**
13 of 19 routes have no error component and 17 of 19 have no loader. A failed network on `/clubs/$clubId` currently bubbles to the root error UI. With loaders + boundaries:
- Faster first paint (loader runs before component).
- Localized error UI ("This club couldn't load. Try again." not full-page crash).
- Proper 404 for deleted events instead of empty state confusion.

**4. Server-side rate limiting on the public check-in endpoints.**
`studentCheckIn`, `lookupStudent`, `confirmReturningStudent`, `fastCheckIn`, `getRememberedStudent` are unauthenticated and reachable by anyone with a QR. A bot can hammer `lookupStudent` to enumerate which 900 numbers exist (currently returns `student_not_found` vs `student_exists` distinguishably). Add:
- A small `rate_limits` table keyed by `(qr_token, ip_hash, action)` with a 10s window.
- Constant-time response shape so `lookupStudent` returns the same generic "Check the number and try again" for both wrong-number and DB error.
- Cap at e.g. 10 requests / 10s / IP / event.

**5. Wrap multi-step writes in a Postgres function for atomicity.**
`studentCheckIn` does: insert student → insert attendance → insert device session, with no transaction. If step 2 fails, you get an orphan student row that breaks the next attempt (the unique 900 number now matches a stranger). Move to a single SQL `RPC create_first_time_attendance(...)` that does all three in one transaction.

---

### Tier 2 — Production hardening

**6. Observability.**
- Wire `console.error` calls to a real sink (Sentry or LogSnag) — `server-errors.ts` already logs structured payloads, just needs an HTTP shipper at the worker boundary.
- Add a `request_id` header in `requireSupabaseAuth` and echo it on every error response so a host reporting a bug can hand you a single string to grep.
- Add a tiny `/api/public/health.ts` route that pings the DB and returns `{ ok, dbLatencyMs }` for uptime monitoring.

**7. Realtime / Display screen presence.**
On the projector display (`events.$eventId.display.tsx`), if realtime drops mid-event, the count freezes silently. Add:
- Reconnect indicator chip in the corner ("Reconnecting…" pill).
- Auto-recover on `visibilitychange` and on `online` events.
- Heartbeat every 30s to detect zombie sockets.

**8. PWA install + offline shell.**
Manifest is wired and `apple-mobile-web-app-capable` is set. Missing:
- A real service worker that caches the iOS shell, fonts, and `/icons/*` for offline launch.
- Background sync queue for failed manual check-ins so a flaky lobby Wi-Fi doesn't lose the row.
- "App update available" toast when a new SW activates.

**9. Per-route OG images and per-route `<title>`.**
Root `__root.tsx` sets a single OG image and most child routes inherit it. For shareable surfaces (`/check-in/$qrToken`, `/clubs/$clubId`, `/events/$eventId`) generate route-specific titles/descriptions that include the event or club name, so a shared link in iMessage previews correctly.

**10. CSV export hardening.**
`exportEventAttendance` builds CSV in a string in memory. For an event with 5k attendees that's fine; at 50k it'll OOM the worker. Switch to streaming response (`new Response(stream)`) and stop loading all rows at once — page in chunks of 1000 (matching Supabase's default cap, which is also a current bug: any export > 1000 rows is silently truncated today).

---

### Tier 3 — Quality, performance, polish

**11. Code-split the two giant files.**
`host-management.tsx` is 1,260 lines (every dialog, card, helper) and `attendance-hq.functions.ts` is 1,619 lines (~25 server fns). Both get pulled into every route. Split:
- `host-management.tsx` → `dialogs/club-dialog.tsx`, `dialogs/template-dialog.tsx`, `cards/event-card.tsx`, `cards/template-card.tsx`, `forms/event-form.tsx`, `action-sheet.tsx`, `shared/use-require-host.ts`.
- `attendance-hq.functions.ts` → `functions/clubs.ts`, `functions/events.ts`, `functions/attendance.ts`, `functions/public-check-in.ts`, `functions/templates.ts`. Keeps tree-shaking honest and makes the public check-in route's bundle ~70% smaller.

**12. React performance pass.**
`events.$eventId.tsx` (959 lines, 30 useState calls, recomputes the roster filter on every keystroke). After moving to TanStack Query:
- Memoize `filteredAttendance`, `sortedAttendance` with `useMemo` keyed on the underlying array reference.
- Debounce `rosterQuery` by 150ms.
- Virtualize the roster list (use `@tanstack/react-virtual`) above ~100 rows so a 2k-attendee event doesn't paint 2k DOM nodes.

**13. Form UX consistency.**
The Create Club / Template error-summary pattern from the recent fix should be lifted into a shared `<FormErrorSummary form={form} labels={...} />` and applied to:
- `events.new.tsx` / `events.$eventId.edit.tsx` (sticky CTA already exists, just missing the summary on some legs).
- `onboarding.club.tsx`, `onboarding.event.tsx`, `sign-up.tsx`, `reset-password.tsx`.

**14. Accessibility audit.**
- Every `Dialog`/`Drawer` already has a title; verify focus-trap returns to the trigger on close.
- Add visible focus rings on `ActionTile` and `ListRow` (currently relies on tap, no keyboard affordance).
- Run `axe` against `/home`, `/events/$eventId`, `/check-in/$qrToken`. Public check-in must pass — students with screen readers will use it.
- Increase contrast on the `.muted-foreground` chip text against the `hero-wash` gradient (currently ~3.8:1).

**15. Test suite (currently zero tests).**
Add Vitest + React Testing Library and cover the high-risk paths. Minimum viable set:
- `safeMessage`, `normalizeSupabaseAuthError` — pure functions, easy.
- Schema validators in `attendance-hq-schemas.ts` (timing refinements, 900-number regex).
- `getCheckInStatus` state machine (open / upcoming / closed / inactive / archived).
- One Playwright e2e: sign in → create club → create event → public student check-in → host sees the row.

---

### Tier 4 — Operational

**16. Backups + restore drill.**
Lovable Cloud takes backups but you've never restored. Before launch: run a restore against a scratch project from a 24h-old snapshot, verify attendance rows survive. Document the runbook in `/docs/runbooks/restore.md`.

**17. Onboarding for new universities.**
Today universities are seeded by migration (`UNG Dahlonega` is the only row). Build a tiny admin route under `/_admin/universities` (gated by the existing `has_role(_, 'admin')`) so you don't need a migration per new school. Feed the existing empty-universities guard so hosts at a new school see a clear "Your school isn't set up yet" CTA.

**18. Privacy + retention.**
- Publish a privacy policy route (`/legal/privacy`) — students are submitting names, emails, 900 numbers.
- Add a scheduled job (pg_cron) that purges `student_device_sessions` older than 180 days and `attendance_actions` older than 1 year.
- Self-service "delete my data" link on the public check-in success screen — emails support@ with the 900 number.

**19. Email + custom domain.**
You're on `attendance-hq.com` — wire transactional email through Resend (sign-up confirmations, password reset) on that domain so emails don't land in spam from the default Supabase sender.

---

### Suggested execution order

1. **Week 1 (correctness):** Tier 1 items 1–5. These are the difference between "it works for one demo" and "it works for 200 events on a Friday night."
2. **Week 2 (resilience):** Tier 2 items 6–10. Observability first so you can measure the rest.
3. **Week 3 (polish):** Tier 3 items 11–15. Most user-visible quality wins.
4. **Pre-launch:** Tier 4 items 16–19.

### Out of scope for this plan

- No new product features (notifications inbox, multi-host clubs, role delegation, etc.) — those are roadmap, not launch-readiness.
- No redesign of existing screens — recent iOS pass is solid.
- No replacement of Lovable Cloud / Supabase — current architecture scales fine for this footprint with the changes above.

