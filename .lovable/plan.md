# Owner Console — native iOS feel on mobile

Goal: on phone widths the owner pages look and behave like a native iOS app, and every owner page (Overview, Organizations + org detail, Users, Members, Events, Attendance, Growth, Product) renders correctly with no horizontal table scrolling or clipped headers. Desktop stays exactly as it is today.

## What changes for the user

- **Bottom tab bar** instead of the current horizontally scrolling pill row. Five primary tabs (Overview, Orgs, People, Events, More) fixed to the bottom with safe-area padding, iOS-style icon + tiny label, active tab tinted. "More" opens a grouped sheet with the remaining sections (Attendance, Growth, Product, sign out, signed-in email).
- **iOS large-title headers**: each page opens with a big bold title and a one-line plain-English subtitle, with a frosted sticky bar appearing on scroll instead of the current boxed header.
- **Tables become grouped cards on mobile.** Today every owner table is forced to a 760px minimum width, so phones get sideways scrolling. On mobile each row renders as a tappable grouped list row: primary line (name), secondary line (org / email), and the two most relevant numbers on the right. Full tables still render from `sm:` up.
- **Segmented controls** for the 30d / 90d / 12m range switchers, matching iOS.
- **Cards and stats retuned for phone**: single-column stacking, rounded 20-24px corners, softer shadows, larger tap targets, tabular numerals, charts get a reduced height and fewer x-axis ticks so labels stop overlapping.
- **Search** uses the rounded iOS search field.
- **Pagination** becomes a full-width "Load more"-style pair of large buttons on mobile rather than tiny icon buttons.

## Technical notes

Reuse the existing iOS design system rather than inventing new styles: `.ios-card`, `.ios-grouped`, `.ios-list-row`, `.ios-glass`, `.ios-large-title`, `.ios-section-label`, `.ios-press`, `pt-safe-1` / `pb-safe-1` in `src/styles.css`, plus `LargeTitleHeader`, `FrostedTopBar`, `GroupedList`, `ListRow`, `SegmentedControl`, `IosSearchField`, `Chip` from `src/components/attendance-hq/ios.tsx`.

1. `src/components/owner-admin/ui.tsx`
   - `OwnerAdminShell`: keep the `lg:` sidebar; replace the mobile top pill nav with a frosted top bar plus a fixed bottom tab bar and a "More" sheet; add bottom padding to `main` so content clears the tab bar.
   - `PageHeading`: render `ios-large-title` styling below `lg`, current styling above.
   - `SectionCard`: rounder radius and edge-to-edge card on mobile.
   - `DataTable`: add an optional `mobile` prop describing the card row (title, subtitle, right-hand values). When absent, fall back to a generated row from the first three columns so no page breaks. Table markup only renders at `sm:` and up.
   - `Pager`, `SearchField`, `KpiGrid`, `GlanceCard`, `StatRing`, chart wrappers: mobile-size variants; charts get `height` and tick-count adjustments under `useIsMobile()`.
2. Each owner route (`owner-admin.index`, `organizations.index`, `organizations.$clubId`, `users`, `members`, `events`, `attendance`, `growth`, `product`): pass the `mobile` row config to `DataTable`, swap range tabs to `SegmentedControl`, and fix any row that mixes text with fixed widgets to the `grid-cols-[minmax(0,1fr)_auto]` + `min-w-0` + `shrink-0` pattern.

No server functions, SQL, or data shapes change — this is presentation only.

## Verification

Drive the preview with Playwright at 393x852, visit all nine owner pages, screenshot each, and confirm: no horizontal overflow, no clipped titles, tab bar visible above the home-indicator area, charts readable, and no console errors. Also spot-check one desktop width to confirm nothing regressed.
