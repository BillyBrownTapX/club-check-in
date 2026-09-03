# Make Retention, Event success, and Growth reflect real event history

The tiles are already computed from live check-in and pre-check-in rows, but the rules deciding *which* events count are wrong, so the numbers look stale and too low. Confirmed against current data (today is Sep 3, 2026):

- Today's event "Speed Dating" has 21 check-ins and 16 pre-check-ins, but every metric ignores it because an event only counts once its **date** is strictly before today. A meeting that already ended today is invisible.
- 8 of the 11 "past" events are empty April/July duplicates that were never actually held. They still divide into the average, so attendance per event reads about 4 instead of roughly 17.
- Retention only judges members whose first activity predates the newest finished event's date, so with the current data only a handful of members are eligible — the percentage swings wildly.
- Attendance per event counts a student twice when they pre-checked in and then checked in, inflating some events.

## New rules

1. **A concluded event** = its check-in window has closed (timestamp comparison against now), not "date before today". Today's finished event counts immediately.
2. **Held events** = concluded events with at least one check-in or pre-check-in. Empty duplicates are excluded from averages and charts, since they never happened.
3. **Attendance per event** = unique students for that event (check-ins and pre-check-ins deduplicated).
4. **Event success** = average unique attendance across held events ÷ total members. Hint reads e.g. "Avg 17 per event · 3 held".
5. **Retention** = of members whose first activity happened before the most recent held event ended, the share who attended more than one distinct event. Uses timestamps so a member from earlier today is not wrongly counted as eligible.
6. **Growth 30d** stays first-activity based (already correct) and now includes activity at events finishing today.
7. **Total members** unchanged: every unique student who ever checked in or pre-checked in across the host's clubs.

## Modal charts

- Attendance-per-event chart and the average reference line use held events only, with unique attendance, so the chart total matches the tile.
- Retention bar and events-per-member buckets use the same eligibility set as the tile.
- Weekly new members unchanged.

## Technical details

- `getHostMemberMetricsForUser` and `getHostMetricBreakdownForUser` in `src/lib/attendance-hq.functions.ts`: select `check_in_closes_at` alongside `id, event_date, event_name`; replace the `event_date < todayIso` filters with a `closedAt < now` check; build a per-event `Set<student_id>` during the paginated scan so attendance is unique per event; derive `heldEventIds` from events with a non-empty set; compute averages, retention eligibility, and success from those.
- `pastEventCount` keeps its name but now means held events; hints in `src/routes/home.tsx` and `src/components/attendance-hq/metric-detail-sheet.tsx` get wording that matches ("held").
- No schema change, no migration, no change to check-in behavior, tile layout, Members tile, or exports.
