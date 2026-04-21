

## Lock the bottom tab bar to the visible viewport on mobile

### Why it moves today

The tab bar is `position: fixed; bottom: 0`, but on mobile browsers (iOS Safari, Chrome Android) `position: fixed` is anchored to the **layout viewport**, not what the user sees. When the URL bar collapses/expands during scroll, the visible area changes height while the layout viewport doesn't — so the bar appears to slide. Two extra problems compound it:

1. The nav uses inline dynamic `pb-[max(0.6rem,env(safe-area-inset-bottom))]`. On iOS the safe-area inset value itself changes as the home indicator zone is reclaimed during URL-bar transitions, so the bar's own height jumps mid-scroll.
2. Without compositor-layer promotion, iOS repaints the bar each frame during URL-bar animation, producing the visible drift.

### The fix

**1. `src/routes/__root.tsx` — sync the visual viewport to a CSS variable**

Add a small `useEffect` in `RootComponent` that:
- Reads `window.visualViewport` on `resize` and `scroll`.
- Computes `offset = window.innerHeight - visualViewport.height` (how much of the layout viewport is hidden by browser chrome at the bottom).
- Writes `--visual-bottom: {offset}px` onto `<html>` via `requestAnimationFrame`.
- SSR-guarded; no-ops on desktop and in standalone PWA mode (where `visualViewport.height === innerHeight`).
- Cleans up listeners on unmount.

This is the only reliable cross-browser way to keep a fixed element pinned to what the user actually sees.

**2. `src/styles.css` — harden the tab bar**

- Add `:root { --visual-bottom: 0px; --tabbar-bottom-offset: env(safe-area-inset-bottom, 0px); }`.
- Add a `.ios-tabbar-shell` rule (new wrapper class) with `position: fixed; left: 0; right: 0; bottom: var(--visual-bottom, 0px); transform: translate3d(0,0,0); -webkit-transform: translate3d(0,0,0); will-change: transform; z-index: 40;`. The `translate3d` promotes the bar to its own compositor layer so iOS stops repainting it during scroll.
- Add `html, body { overscroll-behavior-y: none; }` (already partially present — verify and consolidate) so pull-to-refresh doesn't drag the layout.

**3. `src/components/attendance-hq/host-shell.tsx` — restructure the nav**

- Change the outer `<nav>` from `fixed inset-x-0 bottom-0 ... pointer-events-none` plus inline dynamic padding to use the new `.ios-tabbar-shell` class for positioning.
- Move the safe-area padding from a Tailwind arbitrary value to a stable CSS variable: `paddingBottom: max(0.6rem, var(--tabbar-bottom-offset))` on the inner container. This stops the height-jump cause.
- Keep all visual styling (rounded glass tab bar, grid, icons, active state) unchanged.
- Keep `touch-action: manipulation` on the `<Link>` items.

### Behavior after the change

- Mobile browser (iOS Safari / Chrome Android): tab bar stays glued to the bottom of the visible viewport while the URL bar collapses/expands. No drift, no height jump.
- Installed PWA: identical to today (`--visual-bottom` resolves to 0, no chrome to track).
- Desktop: unchanged.
- Safe area / home indicator on iPhone: still respected via `--tabbar-bottom-offset`.

### Files touched

- `src/routes/__root.tsx` — add visualViewport sync `useEffect`.
- `src/styles.css` — add `--visual-bottom`, `--tabbar-bottom-offset`, `.ios-tabbar-shell` rule, overscroll lock.
- `src/components/attendance-hq/host-shell.tsx` — swap nav positioning to `.ios-tabbar-shell`, replace inline dynamic padding with stable variable.

### Out of scope

- No change to tab content, icons, routing, or active-state behavior.
- No change to top bar, page padding, screens, or PWA manifest.
- No new dependencies.

