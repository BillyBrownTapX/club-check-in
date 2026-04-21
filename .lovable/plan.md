
Transform Attendance HQ into a true mobile-first iPhone-style web app, prioritizing the host workspace, student check-in flow, and auth/onboarding, while deferring deeper PWA work to a later phase.

1. Design system and app-shell foundation
- Rebuild `src/styles.css` around a premium UNG-inspired palette:
  - UNG blue as primary
  - restrained gold accent token
  - softer cool neutrals for backgrounds/surfaces
  - larger radii, softer shadows, cleaner borders
- Add mobile app primitives to the global stylesheet:
  - Apple-style system font stack
  - safe-area helpers
  - app background gradients/tints kept subtle
  - motion tokens for pressed/transition states
- Update `src/routes/__root.tsx` so the whole app feels like an app shell:
  - mobile-friendly viewport/meta refinements
  - full-height layout
  - better main content spacing
  - top-level safe-area padding behavior

2. Replace the current host shell with a native-feeling mobile shell
- Rework `src/components/attendance-hq/host-shell.tsx` into a true mobile-first shell:
  - compact sticky top bar with page context
  - premium bottom tab bar for Clubs and Events
  - thumb-reachable floating/new-event action where appropriate
  - safe-area-aware bottom spacing
- Make desktop an enhancement rather than the default:
  - keep wider layouts for tablet/desktop
  - remove the current “desktop-first center column with mobile fallback” feel
- Ensure all host screens inherit this shell cleanly through `ManagementPageShell`.

3. Unify host management components around mobile patterns
- Refactor shared components in `src/components/attendance-hq/host-management.tsx`:
  - larger type hierarchy
  - taller inputs/buttons
  - grouped settings-style cards
  - stacked mobile filter patterns
  - stronger CTA hierarchy
- Convert dialogs that currently feel desktop-popup-like into mobile-friendly sheets/full-screen panels:
  - `ClubDialog`
  - `TemplateDialog`
  - manual check-in and related event tools
- Keep existing backend actions intact, but redesign their presentation for tap-first mobile use.

4. Rebuild the events workspace for mobile operations
- Update `src/routes/events.index.tsx` into a mobile control center:
  - stacked status sections
  - tappable event cards with stronger hierarchy
  - filters/search redesigned as collapsible or segmented mobile controls
  - open/upcoming/review grouping that is easy to scan one-handed
- Reduce visual density and eliminate desktop dashboard leftovers.

5. Re-architect the event detail page as a true mobile ops console
- Redesign `src/routes/events.$eventId.tsx` as the highest-priority host screen:
  - sticky event header
  - key metrics first
  - primary actions docked or grouped into mobile action clusters
  - live roster transformed into mobile list cards instead of dense desktop layout
- Improve mobile workflows for:
  - recent check-ins
  - search/filter/sort
  - remove/restore actions
  - manual check-in
  - export/duplicate/archive/close
- Use progressive disclosure so the screen stays fast to comprehend on iPhone widths.

6. Convert event editing and creation into guided mobile forms
- Rework `EventForm` in `src/components/attendance-hq/host-management.tsx` and the routes using it:
  - `src/routes/events.new.tsx`
  - `src/routes/events.$eventId.edit.tsx`
  - `src/routes/onboarding.event.tsx`
- Move from “form on a page” to “guided mobile event setup”:
  - single-column only
  - grouped sections
  - cleaner timing controls
  - clearer template selection
  - sticky submit area on mobile where helpful
- Make edit/create feel like native settings or scheduling flows.

7. Redesign clubs screens for mobile management
- Update `src/routes/clubs.index.tsx` and `src/routes/clubs.$clubId.tsx`:
  - cleaner mobile summary cards
  - stacked stats
  - mobile-optimized club actions
  - event/template sections that feel like grouped lists rather than desktop grids
- Improve the detail page structure so club info, templates, and events are easy to manage on phone screens.

8. Upgrade auth and onboarding into premium mobile entry flows
- Refresh `src/components/attendance-hq/host-onboarding.tsx` and routes:
  - `sign-in`
  - `sign-up`
  - `forgot-password`
  - `reset-password`
  - `onboarding.club`
  - `onboarding.event`
- Make these flows feel like polished native onboarding:
  - stronger vertical rhythm
  - larger titles
  - more premium card surfaces
  - cleaner helper text
  - iPhone-native input/button sizing
- Preserve existing auth logic and redirects while improving the product feel.

9. Polish the public student check-in flow as a native mobile experience
- Refine `src/components/attendance-hq/public-check-in.tsx` and `src/routes/check-in.$qrToken.tsx`:
  - stronger first-time vs returning pathways
  - bigger, cleaner form hierarchy
  - more confidence-building confirmation/success/error states
  - clearer blocked states
- Treat this as an installable-web-app style phone flow:
  - immersive width usage
  - safe-area spacing
  - large tap targets
  - native-feeling cards and buttons
- Preserve the existing logic while making it feel much more polished and intentional.

10. Redesign the QR display route for mobile control and presentation
- Refine `src/routes/events.$eventId.display.tsx` so it works better from a phone and on larger displays:
  - mobile host controls that do not feel cramped
  - cleaner fullscreen entry
  - higher-contrast attendance metrics
  - more premium projection layout
- Keep the live polling behavior and backend unchanged.

11. Implementation strategy
- Start with the design tokens and shell first so every screen inherits the new direction.
- Then rebuild shared host/auth/public components before touching individual routes.
- After that, convert screens in this order:
  1. host shell + shared management primitives
  2. events detail
  3. events index
  4. edit/create event flows
  5. clubs flows
  6. auth/onboarding
  7. public check-in
  8. QR display and landing page polish
- Avoid backend/schema changes unless a UI conversion exposes a real gap.

12. Technical details
- No full PWA/service-worker work in this phase; design for app-shell feel now and leave deeper install/offline behavior for later.
- Prefer bottom sheets over centered dialogs on mobile.
- Prefer single-column layouts from 320–430px first, then enhance upward.
- Use existing TanStack route structure and shared component pattern; do not rewrite routing architecture.
- Keep all existing event, club, auth, and check-in functionality intact while redesigning presentation and interaction patterns.

13. Validation after implementation
- Test the host workspace end-to-end on mobile widths:
  - clubs list/detail
  - events list/detail
  - edit/create event
  - manual check-in/remove/restore/export
- Test the student QR flow end-to-end on mobile:
  - first-time check-in
  - returning lookup
  - remembered device flow
  - blocked states
- Test auth/onboarding on mobile:
  - sign in
  - sign up
  - password reset
  - club + event onboarding
- Verify touch comfort, safe-area spacing, sticky bars, and bottom navigation behavior on iPhone-sized screens.
- Verify that larger tablet/desktop layouts still expand gracefully without bringing back the old desktop-first feel.
