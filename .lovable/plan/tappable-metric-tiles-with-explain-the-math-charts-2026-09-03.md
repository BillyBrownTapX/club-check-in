# Tappable metric tiles with explain-the-math charts

Make the Retention, Event success, and Growth tiles on Home open a modal that shows how the number was computed, with interactive charts built from the host's real data.

## Behavior

- Each of the three tiles becomes tappable (Members keeps its current email-draft action).
- Tapping opens a bottom-sheet style modal (mobile-first, same iOS look as the rest of the app) with:
  - The metric headline value.
  - A plain-language formula line showing the actual numbers, e.g. `41 returned ÷ 60 eligible = 68%`.
  - An interactive chart.
  - A short "How this is calculated" note describing the rule and what is excluded.

## Charts per metric

1. **Retention** — horizontal stacked bar of returned vs one-time eligible members, plus a bar chart of members grouped by number of distinct events attended (1, 2, 3, 4, 5+). Hovering/tapping a bar shows the member count.
2. **Event success** — line/bar chart of attendance per past event over time (event name + date on hover), with a reference line at the average, and the roster size as context. Formula line: `avg attendance ÷ total members`.
3. **Growth** — grouped bar of new members in the last 30 days vs the prior 30 days, plus a weekly line of first-time members over the last 60 days. Formula line: `(30d − prior 30d) ÷ prior 30d`.

## Empty and error states

- Not enough data (no past events, no prior-period members) shows the same wording as the tile hint plus an explanation of what is needed, not an empty chart frame.
- A failed detail fetch shows an inline message inside the modal; Home stays working.

## Technical details

- New authenticated server function `getHostMetricBreakdown` in `src/lib/attendance-hq.functions.ts`, reusing the existing accessible-club resolution and the same paginated scan over `attendance_records` + `pre_check_ins` that `getHostMemberMetricsForUser` already uses. It returns:
  - `eventAttendance`: per past event `{ id, name, date, attendees }` sorted by date.
  - `eventsPerMemberBuckets`: `{ bucket: "1"|"2"|"3"|"4"|"5+", members: number }`.
  - `newMembersByWeek`: last ~9 weeks of `{ weekStart, count }`.
  - The same scalar fields already in `HostMemberMetrics` so the modal never disagrees with the tile.
  - Type `HostMetricBreakdown` added to `src/lib/attendance-hq.ts`.
- Query key `queryKeys.members.breakdown()` in `src/lib/query-keys.ts`; fetched lazily via `useAuthorizedQuery` with `enabled` only once a modal opens (60s stale time), so Home's first paint is unchanged.
- New component `src/components/attendance-hq/metric-detail-sheet.tsx` holding the modal shell and the three chart bodies, using the existing `Dialog`/`Drawer` primitives and `recharts` (already installed) via `src/components/ui/chart.tsx` so colors come from design tokens.
- `src/routes/home.tsx`: wrap the three tiles in buttons that set `openMetric` state; render the sheet once. No changes to existing metric math, tile layout, Members behavior, quick actions, or recent events.
- No schema changes, no migration.
