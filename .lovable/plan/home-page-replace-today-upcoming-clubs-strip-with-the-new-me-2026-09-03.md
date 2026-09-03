# Home page — replace Today/Upcoming/Clubs strip with the new metrics

## Goal
The new membership metrics should not live in their own section. They must take the place of the old "Today / Upcoming / Clubs" stat tiles, in that container's position on the page. Everything else on Home stays exactly as-is.

## Changes (one file: `src/routes/home.tsx`)

1. **Remove the "Membership & growth" section entirely** — delete its `SectionLabel`, the loading-skeleton grid, the error card, and the four-tile grid (Members / Retention / Event success / Growth 30d) from their current position above the old stat strip.

2. **Remove the old Today / Upcoming / Clubs horizontal-scroll strip** — delete the `mt-3 -mx-1 flex gap-3 overflow-x-auto` row with its three `StatTile`s, and delete the now-unused `stats` `useMemo` (checkInsToday, upcomingCount, activeClubs).

3. **Render the new metrics in that exact spot** — after the featured-event card and before "Quick actions", render the same four metric tiles (Members with tap-to-export, Retention, Event success, Growth 30d) as a 2-column grid, with their existing loading skeleton and inline error handling. No section label — it sits where the old tiles did, matching the prior layout rhythm (same `mt-3` spacing the strip used).

4. **Cleanup** — remove any imports left unused by the deletion (only if they become unused; keep everything else untouched).

## What does NOT change
- `getHostMemberMetrics` server function, `HostMemberMetrics` type, and query keys — already built and working.
- Greeting header, featured event card, quick actions, recent events, roster CSV export handler.
- No schema, no routing, no behavior changes.

## Verification
- TypeScript check passes.
- Preview Home: confirm the four metric tiles appear directly under the featured-event card, the Today/Upcoming/Clubs strip is gone, and no duplicate metrics section remains.
