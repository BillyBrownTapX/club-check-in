# Rock-solid owner console bottom tab bar

The bottom tab bar on the owner pages (Overview / Orgs / People / Events / More) drifts and jitters while scrolling on mobile. The host app already solved this with a shared pattern; the owner console re-implemented the bar with a plain fixed positioning and doesn't use it.

## What changes for the user

The bottom tab bar stays perfectly still while scrolling — no drift, no jitter as the browser chrome collapses, no overlap of the last row of content, and it still lifts correctly when the on-screen keyboard opens.

## Technical notes

Current owner bar (`src/components/owner-admin/ui.tsx`, `OwnerTabBar`):

```text
<nav class="fixed inset-x-0 bottom-0 z-30 px-3 pb-safe-1 pt-2 lg:hidden">
```

The host shell (`src/components/attendance-hq/host-shell.tsx`) instead uses `.ios-tabbar-shell` from `src/styles.css`, which pins to `bottom: var(--visual-bottom)`, applies `contain: layout paint`, avoids transforms, sets `pointer-events: none` on the shell, and pairs with `.ios-tabbar` for the frosted pill. `--visual-bottom` is kept in sync with the visual viewport by the effect in `src/routes/__root.tsx`, so the bar tracks the keyboard instead of jumping with browser-chrome resize jitter.

1. `OwnerTabBar` nav: replace the ad-hoc `fixed inset-x-0 bottom-0 ... pb-safe-1` classes with `ios-tabbar-shell px-3 pt-2` plus the host shell's inline `paddingBottom: max(0.6rem, var(--tabbar-bottom-offset))`, wrap the pill in a `pointer-events-auto` container, and use `ios-tabbar` on the pill (replacing `ios-glass`) so it renders identically to the host tab bar.
2. Keep the 5-column grid, icons, labels, active tint and the More sheet exactly as they are; add `touchAction: "manipulation"` to the tab links/button so taps don't wait on double-tap detection.
3. Raise the More sheet above the bar: bar is `z-50` under `.ios-tabbar-shell`, so bump the sheet overlay from `z-40` to `z-[60]`.
4. Bottom clearance in `OwnerAdminShell`'s `<main>`: swap the hand-rolled `pb-28` for the shared `pb-tabbar` utility (mobile only, `lg:pb-10` retained), so content always clears the bar including the home-indicator inset.

Presentation only — no data, routes, or server functions change.

## Verification

Drive the preview with Playwright at 393x852 on the owner Overview and a long page (Members), scroll through the content, and screenshot at several scroll offsets to confirm the bar's on-screen position is identical each time, the last row is not covered, and there are no console errors. Spot-check a desktop width to confirm the sidebar layout is unchanged.
