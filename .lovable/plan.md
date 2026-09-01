# Owner Console — visual overhaul + live-data confirmation

## What changes

A styling and layout pass on the Owner console (`/owner-admin` and its 8 sub-pages), plus a data-provenance pass so every number visibly comes from the live application database.

### 1. Layout and chrome

- Replace the current single top bar + horizontal scrolling tab strip with a persistent left sidebar on desktop (collapsible, grouped: Overview / Growth · Organizations · Users · Members / Activity · Events · Attendance / Platform · Product & health), keeping the horizontal strip only on narrow screens.
- Top bar becomes a slim command bar: current section, owner email, live "Data as of <time>" stamp, and a Refresh action that refetches the current page's reports.
- Consistent page header treatment: section eyebrow, title, one-line definition of what the page measures, and the active date range where relevant.

### 2. Visual language

- Darker, denser "analyst console" surface treatment distinct from the phone-first host app: layered panel backgrounds, hairline borders, tighter type scale, tabular numerals everywhere.
- KPI cards get a clearer hierarchy (label, big number, delta/hint, optional sparkline) and tone colors driven by semantic tokens instead of raw palette classes.
- Tables get sticky headers, zebra-free hover rows, right-aligned numerics, and per-column min widths so wide reports stay readable.
- Status pills and health bars move to the project's success/warning/destructive tokens.

### 3. Fix the chart theming bug (real defect found)

Chart axes, grid lines, and tooltips currently pass `hsl(var(--border))`, `hsl(var(--card))`, etc. This project defines those tokens in `oklch`, so wrapping them in `hsl()` yields invalid colors — grid lines, axis labels and tooltip surfaces are not rendering in the intended theme colors. Series colors are also hardcoded hex (`#22c55e`, `#38bdf8`, `#f59e0b`, `#a78bfa`).

Fix: read the CSS variables directly (`var(--border)`, `var(--card)`, `var(--muted-foreground)`) and move every series to the existing `--chart-1…5` tokens, so charts follow the design system and both themes.

### 4. Live-data confirmation and honesty

Verified this turn: every Owner console figure is produced by the `owner_admin_*` SQL reporting functions, and each of those aggregates the live application tables — `clubs`, `host_profiles`, `students`, `club_members`, `events`, `attendance_records`, `pre_check_ins`, `analytics_events`. There is no mocked, seeded, or hardcoded metric anywhere in the console. Current live volumes: 4 organizations, 38 students, 20 events, 52 check-ins, 3 pre-check-ins.

The UI work will make that provenance visible and unambiguous:
- Each report card gets a short source/definition line (what it counts and over what window).
- A real "Data as of <timestamp>" stamp plus per-page refresh, so a stale cached view is never mistaken for live truth.
- Empty and low-volume states say "no data yet" explicitly instead of showing `—` or `0` that could read as a broken widget — important while the platform is still small.
- Product & health continues to label metrics as historical (derived from records) vs tracked (from telemetry since instrumentation started), with the tracking-start date shown.

## Out of scope

No changes to the reporting SQL, the owner-only authorization model, or which metrics exist. Numbers stay exactly as computed today; only presentation changes.

## Technical notes

- Edits concentrate in `src/components/owner-admin/ui.tsx` (shell, nav, KPI, table, chart primitives) plus light per-route adjustments in the 9 `src/routes/owner-admin*.tsx` files.
- New owner-console surface/chart tokens, if needed, are added to `src/styles.css` in `oklch` — no hardcoded color utilities in components.
- Refresh uses TanStack Query invalidation of the current page's query keys; no new server functions.
- Verification: typecheck, then a Playwright pass to confirm the console renders and non-owner accounts still redirect away.
