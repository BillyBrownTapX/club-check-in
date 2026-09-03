# Home metrics: members, retention, and growth

Replace the three thin tiles on the host Home page (Today / Upcoming / Clubs) with a real membership and growth panel driven by actual check-in and pre-check-in data across every club the host belongs to.

## New metrics

1. **Total members** — unique students who have ever checked in OR pre-checked in to any event across all of the host's clubs. This is the outreach list size (each member has an email on file), so the tile reads e.g. "142 members · contactable emails" and links to the existing full member CSV export.
2. **Member retention** — of members whose first check-in happened before the most recent past event, the share who attended at least one later event. Shown as a percentage with the underlying counts (e.g. "68% · 41 of 60 returned"). Only counts events already past, so it never reports on events that haven't happened.
3. **Event success score** — average attendance per past event compared to total members, i.e. typical turnout as a percentage of the roster, plus the new-member count from the last 30 days. Displayed as a score with a plain-language hint ("Avg 24 per event · 31% of members").
4. **Growth rate** — new members (first-ever check-in) in the last 30 days versus the prior 30 days, shown as a signed percentage with an up/down direction.

Kept alongside these: check-ins today and upcoming events, folded into the same panel so nothing existing is lost.

## Layout

- Home keeps its greeting, featured event card, quick actions, and recent events untouched.
- The current horizontal strip of three tiles becomes a "Membership & growth" section: a 2-column grid of stat tiles on mobile (Members, Retention, Success, Growth) plus a compact row for Today / Upcoming / Active clubs.
- Loading shows skeleton tiles rather than a text placeholder; failure shows a small inline message and leaves the rest of Home working.

## Technical details

- New authenticated server function `getHostMemberMetrics` in `src/lib/attendance-hq.functions.ts`, using the existing user-scoped Supabase client so RLS restricts data to the host's clubs (same access path as `getHostClubSummariesForUser`).
  - Resolve accessible club ids, then past/all events for those clubs.
  - Page through `attendance_records` (event_id, student_id, checked_in_at) and `pre_check_ins` (event_id, student_id, checked_in_at) for those events, 1000 rows at a time — same pagination approach already used by the members CSV route.
  - Compute in memory: unique member set, per-member first/last activity and distinct event count, retention, average attendance per past event, 30-day and prior-30-day new-member counts, growth percentage.
  - Return a flat typed object; add the type to `src/lib/attendance-hq.ts`.
- New query key `queryKeys.members.metrics()` in `src/lib/query-keys.ts`; consumed on Home via `useAuthorizedQuery` with a 60s stale time.
- `src/routes/home.tsx`: render the new tiles from that query, reuse the existing `StatTile` component, keep the "View roster" export action as the CTA on the Members tile.
- No schema changes, no migration, no changes to check-in behavior.
