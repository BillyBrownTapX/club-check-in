
Transform the app into a stronger mobile-first enterprise product system, keeping the existing functionality intact while rebuilding the visual hierarchy, surface contrast, and interaction structure around iPhone-sized screens.

1. Rebuild the global visual system for stronger enterprise framing
- Update `src/styles.css` to move from soft/light mobile polish to a more defined enterprise system:
  - deeper UNG-inspired blue primary
  - restrained gold accent for highlights only
  - stronger neutral steps for canvas, elevated cards, grouped panels, borders, and muted zones
  - more visible status colors for success, warning, info, and destructive states
- Tighten the typography scale for serious software:
  - stronger page titles
  - more prominent section labels
  - clearer metric/value sizing
  - better contrast for support text
- Add reusable app-surface tokens for:
  - page canvas
  - elevated cards
  - tinted operational panels
  - sticky bars
  - docked action trays
  - high-visibility CTA states
- Improve global depth and hierarchy:
  - more visible borders
  - cleaner shadows
  - less washed-out backgrounds
  - more deliberate separation between sections

2. Strengthen the root app shell and mobile framing
- Refine `src/routes/__root.tsx` so the whole app feels like premium mobile software:
  - stronger app background framing
  - tighter content width logic for phone-first layouts
  - better safe-area behavior
  - improved error and not-found surfaces so even failure states feel product-grade
- Keep the current app-shell architecture, but shift it visually from “website page” to “software canvas.”

3. Rebuild the host shell into a more commanding mobile control layer
- Refactor `src/components/attendance-hq/host-shell.tsx` into a more operational shell:
  - stronger sticky top bar with clearer page context
  - more defined bottom navigation styling
  - more visible active states
  - better spacing around the floating create action
  - cleaner sign-out/action treatment
- Preserve the existing navigation structure, but make it feel like serious operational software instead of a light mobile wrapper.
- Ensure the uploaded logo experience remains intact and visually integrated in the shell header.

4. Upgrade shared host management primitives before touching screens
- Refactor shared patterns in `src/components/attendance-hq/host-management.tsx`:
  - `PageHeader`
  - `FormCard`
  - `StatsCard`
  - buttons
  - filter bars
  - text inputs
  - event/club/template cards
- Make each primitive more visually dominant and enterprise-ready:
  - stronger container framing
  - better card segmentation
  - larger, clearer action areas
  - more structured metadata presentation
  - stronger CTA hierarchy
- Replace weak “flat card” moments with clearer primary/secondary surface layering.

5. Convert modal and sheet patterns into stronger mobile overlays
- Rework `ClubDialog`, `TemplateDialog`, and manual/event action overlays in `src/components/attendance-hq/host-management.tsx` and `src/routes/events.$eventId.tsx`:
  - more native mobile sheet behavior
  - stronger headers
  - better internal sectioning
  - clearer submit zones
  - more substantial confirmation dialogs
- Keep the current logic and actions, but make overlays feel like enterprise mobile workflows rather than generic dialogs.

6. Redesign the events index into a true mobile operations hub
- Refactor `src/routes/events.index.tsx` around clearer mobile scanning:
  - stronger top summary/header treatment
  - more structured filter controls
  - better grouping for open, upcoming, review, and archived events
  - improved card sizing and action prominence
- Replace any remaining dashboard-like layout leftovers with tighter, stacked operational sections.
- Make event cards feel faster to scan and more valuable:
  - stronger status treatment
  - clearer metrics
  - more obvious next actions

7. Re-architect the event detail page as the flagship enterprise mobile screen
- Refine `src/routes/events.$eventId.tsx` into a more powerful command-center experience:
  - stronger event header
  - more visible metrics
  - clearer live-state framing
  - improved action grouping for edit, duplicate, display, manual, export, archive, and close
- Redesign the live roster area for better phone scanning:
  - clearer search/filter/sort controls
  - more structured roster rows/cards
  - stronger separation between identity, timestamp, and destructive actions
- Improve supporting panels:
  - recent arrivals
  - restore removed
  - post-event review
  - recent actions
- Use more deliberate hierarchy so the event screen feels fast, powerful, and executive-grade on a 390px viewport.

8. Upgrade event create/edit flows into stronger guided mobile forms
- Refine `EventForm` and the routes that use it:
  - `src/routes/events.new.tsx`
  - `src/routes/events.$eventId.edit.tsx`
  - `src/routes/onboarding.event.tsx`
- Improve the form system with:
  - clearer grouping
  - stronger section titles
  - better timing controls
  - more readable computed check-in timing blocks
  - more premium sticky action area
- Remove any remaining “long generic form” feel and make the flow feel intentional and structured.

9. Redesign auth and onboarding with stronger enterprise trust signals
- Refactor `src/components/attendance-hq/host-onboarding.tsx` plus:
  - `src/routes/sign-in.tsx`
  - `src/routes/sign-up.tsx`
  - `src/routes/forgot-password.tsx`
  - `src/routes/reset-password.tsx`
  - `src/routes/onboarding.club.tsx`
  - `src/routes/onboarding.event.tsx`
- Strengthen these screens with:
  - more premium framing
  - stronger visual emphasis on titles and next steps
  - more visible form containers
  - improved helper/success/error presentation
  - better bottom spacing and button prominence
- Keep the auth logic unchanged while making the experience feel more credible and high-value.

10. Refine the student check-in flow into a stronger, more visible mobile product experience
- Rework `src/components/attendance-hq/public-check-in.tsx` and `src/routes/check-in.$qrToken.tsx`:
  - larger, more defined event info framing
  - more visible state badges
  - stronger action choice cards
  - clearer input blocks
  - improved success and blocked states
- Make first-time, returning, remembered-device, confirm, and success states feel more operational and trustworthy.
- Ensure the public flow still feels clean and fast, but no longer soft or visually weak.

11. Redesign the QR display screen for stronger presentation and host confidence
- Refine `src/routes/events.$eventId.display.tsx`:
  - more premium stage-like framing
  - stronger metric contrast
  - cleaner top controls
  - more authoritative attendance count presentation
  - better proportioning between QR, event context, and live count
- Keep the live polling behavior intact while making the screen feel presentation-ready and enterprise-grade.

12. Refresh landing and brand entry surfaces
- Update `src/routes/index.tsx` and shared primitives in `src/components/attendance-hq/primitives.tsx` so the first impression matches the upgraded product standard.
- Keep the logo upload/render behavior working, but visually integrate it better across public and authenticated shells.
- Strengthen marketing/entry surfaces so the app feels like premium software from the first screen.

13. Implementation order
- Apply the redesign in this order so the visual system stays coherent:
  1. global tokens and root shell
  2. host shell
  3. shared host management primitives
  4. event detail
  5. events index
  6. event create/edit/onboarding event
  7. auth + onboarding
  8. public student check-in
  9. QR display
  10. landing/primitives cleanup
- Avoid backend changes unless the redesign exposes a genuine product gap.

14. Technical details
- Keep TanStack routing and current server/backend behavior unchanged.
- Preserve the existing uploaded-logo behavior and storage-backed rendering.
- Stay single-column first at 390px, then enhance upward.
- Favor stronger surface definition over gimmicky effects.
- Use more visible contrast, borders, and elevation, but keep motion restrained and product-like.

15. Validation after implementation
- Check all major flows at 390px wide first:
  - sign in / sign up / reset password
  - onboarding club / onboarding event
  - events list / event detail / create / edit
  - manual check-in / remove / restore / export / archive / close
  - QR display
  - student first-time / returning / remembered / blocked / success
- Verify touch targets, bottom nav comfort, sticky bars, safe-area padding, and CTA clarity.
- Test the uploaded logo flow end-to-end to confirm the new shell still uploads, persists, and renders correctly.
- Verify tablet and desktop still scale gracefully without reintroducing desktop-first visual structure.
