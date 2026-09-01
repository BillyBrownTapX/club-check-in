# Owner Console — simple, Apple-inspired overview

## The problem

The overview page currently opens with a "North Star" card and then four dense
KPI grids (organizations, people, activity, trends) — 16+ numbers with jargon
like "at risk", "dormant / never activated", "avg per active organization".
Nothing tells you, in one glance, how many people are on the app.

## What the new overview shows

Top of page, three large glanceable numbers in an Apple-style hero:

```text
┌──────────────────────────────────────────────────────────────┐
│  People on Attendance HQ                                     │
│                                                              │
│      38            12               52                       │
│   members       host accounts    check-ins all time          │
│   +6 this month  4 clubs          9 this month               │
└──────────────────────────────────────────────────────────────┘
```

Below it, three plain-English cards, each with one simple visual:

1. **Have they checked in?** — donut: members who have checked in at least once
   vs. members who never have. Label reads "26 of 38 members have checked in
   (68%)".
2. **Do they come back?** — the retention headline. Big percentage = share of
   checked-in members with more than one check-in ("repeat rate"), with a
   supporting line: "X of last month's attendees came back this month".
   A simple 3-bar chart shows: checked in once / 2–4 times / 5+ times.
3. **Is it growing?** — one area chart of people over time (members added),
   with the 30 days / 90 days / 12 months switch kept.

Every label is a full sentence in plain words. No acronyms, no health scores,
no "at risk" on this page.

## Trimming the other tabs

- **Attendance** — keep check-ins over time, unique attendees, average per
  event. Remove duplicate lifetime tiles that repeat the overview.
- **Growth** — lead with two numbers (activation rate, repeat rate) and the
  funnel bar chart; move the raw cohort grid to the bottom under a collapsed
  "Detailed cohorts" section.
- **Product** — keep the feature-usage bar list; drop low-signal tiles.
- Organizations, Users, Members, Events keep their tables (those are the
  drill-downs) but get the same restyled headers.

## Visual style

Apple-inspired: generous whitespace, large rounded cards with soft shadows,
one accent color, thin hairline dividers, tabular numerals, large light-weight
display numerals with small muted captions, subtle fade-in on load. All colors
via existing semantic tokens in `src/styles.css` (no hardcoded hex), so it stays
consistent with the rest of the app.

## Technical details

- New SQL report `public.owner_admin_people` (security definer, revoked from
  `anon`/`authenticated`, same pattern as the existing `owner_admin_*` reports)
  returning: total members, members with ≥1 check-in, members with ≥2 check-ins,
  check-in frequency buckets (1 / 2–4 / 5+), last-month attendees, of those how
  many returned this month, total host accounts, hosts active in 30 days.
- New server function `getOwnerPeople` in `src/lib/owner-admin.functions.ts`
  behind `requireOwnerAdmin`, plus its TypeScript type.
- Rewrite `src/routes/owner-admin.index.tsx` around the hero + three cards.
- Extend `src/components/owner-admin/ui.tsx` with `HeroStat`, `StatDonut`, and
  `SimpleBars` primitives so the other tabs can reuse the same look; restyle
  `SectionCard`/`KpiCard` with the softer Apple treatment.
- Edit `owner-admin.attendance.tsx`, `owner-admin.growth.tsx`,
  `owner-admin.product.tsx` to drop redundant tiles and collapse the cohort grid.
- All figures stay live from the database — no seeded or sample values.
