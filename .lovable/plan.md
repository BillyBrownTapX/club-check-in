

## Make the host pages feel like a native mobile app

### What's wrong today

The Home / Clubs / Events list / Live screens already use the new iOS shell (`HostAppShell`, `LargeTitleHeader`, ios primitives). But the deeper screens — **Event detail (`/events/$eventId`)**, **Club detail (`/clubs/$clubId`)**, **Create / Edit Event**, and the auxiliary cards in `host-management.tsx` — were built for desktop. On a 390×844 phone they:

- Wrap content in `PageHeader` and `Card`s with **2rem corner radii, heavy shadows, oversized 36px–40px display titles, and 5–6 unit padding** that consume most of the screen.
- Use desktop-leaning grids (`xl:grid-cols-[minmax(0,1.7fr)_24rem]`, side-by-side QR + roster) that collapse into a single tall scroll on phones, pushing primary actions (Show QR, Manual check-in, Edit) below the fold.
- Hide button labels on small screens (`sm:hidden`) so users see icon-only buttons with no clear meaning.
- Render delete/edit/duplicate as a row of `h-12` outline buttons that look interchangeable; nothing reads as the primary action.
- Use a separate non-iOS `PageHeader` block (long marketing-style hero with eyebrow + 2.55rem title) instead of the compact `LargeTitleHeader` the rest of the app uses.

### Goal

Make every host screen render and behave like a native mobile app at 390×844: tight spacing, clear primary action, recognizable tappable rows, no icon-only mystery buttons, and no horizontal overflow. Desktop layouts can stay graceful but the source of truth becomes mobile.

### Changes

**1. Event detail (`src/routes/events.$eventId.tsx`) — full mobile rebuild**

Replace the `ManagementPageShell + PageHeader + multi-column grid` layout with a single-column iOS layout:

- Top: `LargeTitleHeader` with `title={event.event_name}`, `eyebrow={club name}`, and a single trailing `Edit` icon button (pencil). Move the rest of the actions out of the header.
- Below header: a **hero card** (rounded 1.75rem, `hero-wash` gradient when live, neutral `ios-card` when not) showing date · time · location · live attendance count · status chip. One tap target.
- A **2×2 quick-action grid** using existing `ActionTile`s: "Show QR" (gold), "Manual check-in" (blue), "Display fullscreen" (default), "Export CSV" (default). Each tile has an icon AND a visible label AND a hint — solves the "icon-only mystery button" problem.
- A **GroupedList** ("Event tools") row stack for less-frequent actions: Duplicate, Close check-in (only when `status === "open"`), Archive/Reopen, Delete. Each row uses `ListRow` with icon + label + chevron — exactly the pattern Settings already uses, so it matches.
- **Roster section** as a compact iOS card: `IosSearchField` + `SegmentedControl` (All / First scan / Returning / Manual) replacing the 3-column desktop filter grid; sort moves to a small popover triggered from a sort-icon button. Each attendance entry becomes a single-line `ListRow`-style item: avatar circle (initials) · name · time · swipe-style ghost trash button on the right at 32×32. Removes the `flex flex-col gap-3 px-4 py-4 sm:flex-row` two-line stack.
- **QR card** stays but moves to the bottom as a collapsible section (default collapsed) titled "QR check-in" — full-screen QR is the gold ActionTile at top, so the inline QR is reference-only.
- Recent arrivals / Restore removed / Recent actions / Post-event review collapse into a tabbed area at the bottom (same `SegmentedControl` pattern) so the page is short by default and the user opts into history.
- Remove the `PageHeader` import for this route entirely.

**2. Club detail (`src/routes/clubs.$clubId.tsx`) — same mobile pattern**

- Replace `PageHeader` + `FormCard` hero with `LargeTitleHeader` (title = club name, eyebrow = university) and a single trailing `Edit` icon button.
- Show the logo + "Active/Inactive" chip + description in a compact `ios-card` directly below.
- 3 stats become a horizontally-scrollable `StatTile` row (same pattern as Home), not stacked full-width cards.
- Replace the four-button action block with a 2×2 `ActionTile` grid: Create Event, Create Template, Edit Club, Delete Club (delete tile uses destructive tone).
- Upcoming / Past / Templates sections each render as `SectionLabel` + a stack of compact rows (reuse the new `EventCard` mobile variant from change #5 below). Drop the `xl:grid-cols-3` template grid for a single column on phones.

**3. Create / Edit Event form (`EventForm` in `host-management.tsx`)**

- Wrap with `HostAppShell` and `LargeTitleHeader` instead of `PageHeader`. Title = "Create Event" / "Edit Event", subtitle stays.
- Form fields stay full-width and stacked (already correct), but the surrounding `FormCard` loses its 2rem radius / heavy shadow on mobile — use plain spacing so fields fill the viewport.
- Bottom action bar becomes a `StickyCtaBar` (already exists in `ios.tsx`) pinned above the tab bar, containing the primary Create/Save button (full width, `variant="hero"`, `size="xl"`). Cancel / Delete move into a small text-link row above the sticky bar — never competing with the primary action.
- Keep the existing error summary and `SelectInput error={...}` work from the previous fix.

**4. Hide the bottom tab bar on form / detail screens that need full attention**

`HostAppShell` already supports `hideTabBar`. Pass `hideTabBar` on `/events/new`, `/events/$eventId/edit`, and `/events/$eventId/display` routes so the sticky CTA is the only bottom UI on those screens. Detail screens (`/events/$eventId`, `/clubs/$clubId`) keep the tab bar.

**5. `host-management.tsx` — make `EventCard` and `TemplateCard` mobile-first**

Both currently render as 1.9rem-radius cards with a 3-button row that wraps awkwardly on phones.

- `EventCard`: collapse to a single tappable card. Top line: name + status chip. Second line: date · time · location (truncated). Bottom line: "{n} checked in" on the left, an overflow `…` icon button on the right that opens a small action sheet (Manage / Edit / Duplicate / Delete). Whole card links to `/events/$eventId`.
- `TemplateCard`: same compression — name + meta + single overflow menu (Use / Edit / Duplicate). Removes the 3-button grid that overflows.
- `PageHeader` is no longer used by any route after changes #1–#3. Remove the export (or leave it but stop importing it) to prevent regressions.

**6. Type-safety / wiring**

- `events.$eventId.tsx` keeps all server-fn calls and state untouched — only the JSX tree under `return (...)` is restructured.
- All new mobile components reuse existing primitives from `src/components/attendance-hq/ios.tsx` (no new files).
- Add a tiny `ActionSheet` helper inside `host-management.tsx` (built on `Drawer` from `src/components/ui/drawer.tsx`) for the overflow menus on `EventCard` / `TemplateCard` / the event-detail tools section. One small new component, ~30 lines.

### Files touched

- `src/routes/events.$eventId.tsx` — full mobile rebuild of layout (logic unchanged).
- `src/routes/clubs.$clubId.tsx` — replace `PageHeader` hero + button block with iOS shell + ActionTiles.
- `src/components/attendance-hq/host-management.tsx` — mobile-first `EventCard` / `TemplateCard`, new `EventForm` shell using `LargeTitleHeader` + `StickyCtaBar`, new `ActionSheet` helper.
- `src/routes/events.new.tsx` and `src/routes/events.$eventId.edit.tsx` — pass `hideTabBar` so the sticky submit bar owns the bottom of the screen.

### Behavior after the change

- 390×844 viewport: every host screen fits the iOS pattern of the rest of the app — large title, ios-cards, grouped lists, quick-action tiles with explicit labels, sticky primary CTA.
- No icon-only mystery buttons; every primary action has a visible label.
- Event detail page is short by default — QR / history / removed-attendance are opt-in instead of stacked walls of cards.
- Forms (Create/Edit Event) take the whole screen with one obvious primary action at the bottom.
- Desktop (≥768px) still works because the new layout is single-column and centered in the existing 480–520px shell.

### Out of scope

- No changes to server functions, schemas, auth, routing, or business logic.
- No changes to Home, Clubs list, Events list, or Live (already iOS-styled).
- No changes to PWA manifest, tab bar pinning, or the visual viewport sync from the previous fixes.
- No new dependencies.

