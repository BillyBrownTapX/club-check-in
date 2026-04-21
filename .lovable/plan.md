
Apply the new UNG brand system across the entire app by rebuilding the global theme, typography, and shared primitives first, then propagating those changes through every host, auth, onboarding, public check-in, club, and event screen.

1. Rebuild the global brand foundation
- Update `src/styles.css` to align the entire app with the UNG palette:
  - add semantic tokens for `ung-blue`, `ung-blue-light`, `ung-blue-soft`, `ung-blue-muted`, `ung-gold`, `ung-gold-light`, `ung-navy`, and `ung-cream`
  - remap existing system tokens (`background`, `foreground`, `card`, `muted`, `border`, `primary`, `accent`, etc.) to the requested brand values
  - reduce the current dark, smoky enterprise feel and shift to a brighter premium blue-and-gold UNG system
- Add utility classes for:
  - `.font-display`
  - `.text-gradient-gold`
  - `.text-gradient-blue`
  - hero/final-CTA blue gradients
  - subtle blur decorative blobs and reusable elevated surface treatments
- Update base typography in the global stylesheet:
  - Plus Jakarta Sans for all headings
  - Inter for body/UI
  - stronger heading hierarchy and more readable body defaults
- Keep the app mobile-first and consistent with existing safe-area behavior.

2. Align shared button and control styling to the new brand variants
- Update `src/components/ui/button.tsx` so shared buttons support the requested system:
  - `default`
  - `hero`
  - `gold`
  - `gold-outline`
  - refined `outline`, `secondary`, and `ghost`
- Increase touch-friendly sizing and visual prominence:
  - stronger radii
  - bolder font weights
  - clearer shadows
  - improved hover/press states
- Ensure existing app usages still work while giving page-level screens access to the new branded CTA treatments.

3. Refresh app shell, root framing, and global error states
- Update `src/routes/__root.tsx` so the global shell matches the UNG design language:
  - lighter premium canvas
  - cleaner branded error / 404 states
  - more consistent branded primary and secondary actions
- Refine the app shell background treatment to use subtle UNG blue tints and warm neutral surfaces rather than the current heavier enterprise shading.

4. Refresh shared Attendance HQ primitives
- Update `src/components/attendance-hq/primitives.tsx`:
  - restyle `AttendanceLogo` so the uploaded logo area fits the new brand framing
  - align public cards, badges, KPIs, headers, and action cards to the new palette
  - switch headings to display typography
  - update supporting copy colors and surfaces to use the new blue/gold/cream system
- Keep logo upload behavior unchanged while visually integrating it better into headers and landing areas.

5. Refresh shared auth and onboarding primitives
- Update `src/components/attendance-hq/host-onboarding.tsx`:
  - brand `AuthShell`, `AuthCard`, `OnboardingShell`, `FormCard`, and `ProgressIndicator`
  - use UNG blue hero-style framing, gold accent moments, and cleaner white card surfaces
  - apply Plus Jakarta Sans to major headings and stronger button hierarchy
- Make form controls, support links, success banners, and sticky actions visually consistent with the new palette.

6. Refresh shared host-management primitives
- Update `src/components/attendance-hq/host-management.tsx`:
  - restyle `PageHeader`, `FormCard`, `StatsCard`, `FilterBar`, `MetaPill`, `ClubCard`, `EventCard`, `TemplateCard`, dialogs, and input wrappers
  - apply the new brand hierarchy across management screens:
    - stronger blue section framing
    - white elevated cards
    - soft blue and cream supporting surfaces
    - gold for premium CTA emphasis and key highlights
- Preserve all business logic and university-linked club/event flows while changing the visual system.

7. Refresh shared public student check-in primitives
- Update `src/components/attendance-hq/public-check-in.tsx` so the entire public flow inherits the new system:
  - stronger UNG-branded event header
  - clearer primary and success states
  - improved gold/blue CTA hierarchy
  - larger heading hierarchy using display type
- Keep the progressive check-in structure intact while making the experience feel faster, cleaner, and more branded.

8. Update landing and entry experience
- Refresh `src/routes/index.tsx`:
  - convert the current landing hero to a more brand-forward UNG presentation
  - use blue gradient hero framing, gold CTA emphasis, brighter contrast, and stronger typography
  - update cards/highlights to reflect the new palette and text gradient utilities
- Ensure the route feels consistent with the new requested design direction, not just the internal host workspace.

9. Update auth flows
- Refresh:
  - `src/routes/sign-in.tsx`
  - `src/routes/sign-up.tsx`
  - `src/routes/forgot-password.tsx`
  - `src/routes/reset-password.tsx`
- Apply the new branded system consistently:
  - stronger blue/white/gold balance
  - display-type page titles
  - improved trust panels and support blocks
  - updated CTA treatments using the new button variants
- Keep all auth logic unchanged.

10. Update onboarding flows
- Refresh:
  - `src/routes/onboarding.club.tsx`
  - `src/routes/onboarding.event.tsx`
- Bring university selection, setup forms, and progress blocks into the new brand system:
  - clearer form sections
  - stronger display headings
  - improved blue-tinted section wrappers
  - branded sticky submit zones
- Keep all onboarding logic and validation intact.

11. Update clubs management screens
- Refresh:
  - `src/routes/clubs.index.tsx`
  - `src/routes/clubs.$clubId.tsx`
- Apply the new branded cards, stats, action bars, and page headers.
- Make university context more visible visually using the new palette and pill treatments.
- Preserve club creation/edit behavior and required university linkage.

12. Update events management screens
- Refresh:
  - `src/routes/events.index.tsx`
  - `src/routes/events.new.tsx`
  - `src/routes/events.$eventId.edit.tsx`
  - `src/routes/events.$eventId.tsx`
  - `src/routes/events.$eventId.display.tsx`
- Bring the full events experience into the UNG system:
  - blue/gold action hierarchy
  - stronger section cards
  - branded stats tiles
  - better treatment for QR display, live counts, filters, dialogs, and roster rows
- Keep event creation/edit logic, university inheritance, and event ops behavior unchanged.

13. Update public student flow routes
- Refresh `src/routes/check-in.$qrToken.tsx` so the new progressive flow screens visually match the requested palette and typography.
- Re-theme:
  - 900 number entry
  - returning student confirmation
  - first-time creation form
  - success/already-checked-in states
  - blocked/error screens
- Preserve the new university-scoped check-in logic.

14. Font-loading alignment
- Because the requested spec references Google fonts in `src/index.css` while this project currently uses `src/styles.css`, add the font imports in the actual global stylesheet used by the app and wire them into the base rules there.
- Do not create a stray unused `src/index.css`; keep the font system aligned with the existing TanStack root stylesheet path.

15. Implementation safeguards
- Do not change routing, server functions, or database behavior unless a style update requires a small supporting prop/class refactor.
- Preserve:
  - uploaded logo rendering/upload behavior
  - university-linked club/event/student relationships
  - progressive public check-in logic
  - existing mobile-first safe-area patterns

16. Validation after implementation
- Verify all routes visually at the current mobile viewport first:
  - `/`
  - `/sign-in`
  - `/sign-up`
  - `/forgot-password`
  - `/reset-password`
  - `/onboarding/club`
  - `/onboarding/event`
  - `/clubs`
  - `/clubs/$clubId`
  - `/events`
  - `/events/new`
  - `/events/$eventId/edit`
  - `/events/$eventId`
  - `/events/$eventId/display`
  - `/check-in/$qrToken`
- Check for consistency in:
  - UNG blue/gold/cream palette usage
  - Plus Jakarta Sans headings and Inter body text
  - button variants and CTA prominence
  - surface contrast, borders, and shadows
  - mobile spacing and safe-area polish
- Run a typecheck after the styling pass to catch any incidental component prop mismatches introduced during the UI refresh.
