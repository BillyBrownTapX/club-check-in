# Plan — Verify & fix Owner Console range tabs (30d / 90d / 12m)

## Question asked
Should the overview charts change when switching between "30 days", "90 days", and "12 months"? **Yes.** Each tab refetches the series with a different time window and bucketing (day / week / month).

## What the code shows (already verified)
- `src/routes/owner-admin.index.tsx`: the query key includes `range.key` + `payload.bucket`, and the payload (`from`/`to`/`bucket`) is passed to the server function — so a tab click must trigger a refetch and re-render.
- `useAuthorizedQuery` (auth-provider): passes the payload through as `{ data }` and re-runs when the key changes. Correct.
- SQL `owner_admin_series(_from, _to, _bucket)`: buckets by day/week/month across the selected window. Correct.
- Hypothesis for why it looks static: all live data (4 orgs, 20 events, 52 check-ins) is recent, so every range shows the same recent spike over a flat line of zeros. Needs browser confirmation, not assumption.

## Steps
1. **Browser verification (owner account):** open `/owner-admin`, screenshot the "Check-in volume" chart, click 90 days, then 12 months, screenshot each. Confirm the series request fires per tab (network) and the x-axis labels/bucket counts change.
2. **If the chart does not change:** fix the actual cause (e.g. stale closure, key collision, or server function ignoring the window) in `owner-admin.index.tsx` / `owner-admin.functions.ts` as indicated by the evidence.
3. **If the chart does change but looks identical** (most likely): no code bug — leave logic untouched. Optionally add a small "per day / per week / per month" caption (already present) and keep as-is.
4. Also spot-check the same tabs on `/owner-admin/attendance` (KPIs and charts keyed by `range.key`) for the same behavior.
5. Re-verify after any change with the same browser pass; confirm no console errors.

## Out of scope
- No changes to data, SQL functions, or other Owner Console pages unless step 2 proves a defect.
- No visual redesign work.

## Technical notes
- Files involved if a fix is needed: `src/routes/owner-admin.index.tsx`, possibly `src/lib/owner-admin.functions.ts` and `src/components/attendance-hq/auth-provider.tsx`.
- No database or migration changes anticipated.
