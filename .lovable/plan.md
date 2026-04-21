

Rebuild Attendance HQ as a premium iOS-native mobile event hosting app. Replace the current web/enterprise visual language with a true iPhone-first system that feels like an Apple product across every host and student screen, while preserving all existing functionality (auth, university-scoped check-in, club/event/QR flows, remembered devices).

## 1. iOS-native design foundation

Rebuild `src/styles.css` to introduce an Apple-grade material and motion system on top of the existing UNG palette:

- Keep brand tokens (`ung-blue`, `ung-blue-light`, `ung-blue-soft`, `ung-blue-muted`, `ung-gold`, `ung-gold-light`, `ung-navy`, `ung-cream`) but recalibrate `--background`, `--card`, `--muted`, `--border`, and surface tokens to the iOS-style values from the brief (`hsl(210 20% 98%)`, white cards, `hsl(216 20% 90%)` borders).
- Lift base radii: `--radius: 1rem`, plus utilities for `rounded-2xl`/`rounded-3xl` grouped surfaces and pill controls.
- Add iOS material utilities:
  - `.ios-card` — white, soft border, layered shadow, 24px radius
  - `.ios-grouped` — inset list group with hairline dividers
  - `.ios-glass` — translucent blurred header/sheet material
  - `.ios-list-row` — icon + label + chevron row pattern
  - `.ios-large-title` — 32–34px Plus Jakarta Sans heading rhythm
  - `.ios-section-label` — uppercase, tracked, muted small caps
  - `.ios-tabbar` — frosted floating bottom bar
  - `.ios-cta-shadow` — soft tactile shadow for primary buttons
- Refine background wash to a calm blue/cream gradient instead of the current heavier enterprise tint.
- Keep Plus Jakarta Sans (display) and Inter (body) imports; tighten heading letter-spacing and line-height for iOS feel.
- Add safe-area utilities (`pt-safe`, `pb-safe`) using `env(safe-area-inset-*)` for headers, tab bars, and sticky CTAs.

## 2. Button + control system

Update `src/components/ui/button.tsx` for iOS-grade tactility:

- Refine variants: `default` (rich blue), `hero` and `gold` (filled gold with navy text, pill, tactile shadow), `gold-outline`, `secondary` (soft tinted blue), `ghost`, `outline`, plus a new `tonal` variant for soft blue tonal fills used on list rows and segmented chips.
- Increase default height/padding for thumb-friendly targets; add `pill` size.
- Add active-state press scale and shadow softening to imply tap feedback.

Add small shared primitives in `src/components/attendance-hq/ios.tsx` (new file) used across screens:

- `LargeTitleHeader` — iOS large-title pattern with optional trailing action
- `GroupedList` / `ListRow` — Apple Settings–style grouped rows with leading icon, label, value, chevron
- `SegmentedControl` — pill segmented control for filters
- `SectionLabel` — uppercase small caps section header
- `StatTile` — Apple Fitness–style metric tile
- `ActionTile` — large tappable action card (Create Event, Show QR, View Live)
- `BottomSheet` — wraps existing Sheet with iOS bottom-sheet styling
- `FrostedTopBar` — translucent inline top bar for deeper screens
- `SuccessBurst` — premium success confirmation visual

## 3. App shell + navigation

Update `src/components/attendance-hq/host-shell.tsx`:

- Replace the current top-nav web layout with an iOS structure:
  - Frosted top bar (translucent) for inline screens; large titles handled per route.
  - Floating frosted bottom tab bar with five tabs: Home, Clubs, Events, Live, Settings (icons via lucide).
  - Safe-area aware top + bottom padding; tab bar stays above iOS home indicator.
- Add a "Live" tab route (`src/routes/live.tsx`) that surfaces the host's currently running event (or an empty state) — this fulfills the Live event operations screen requirement.
- Add a "Settings" tab route (`src/routes/settings.tsx`) for the profile/settings screen (item #26).
- Add a "Notifications" entry (item #25) reachable from the Home top-bar bell, route `src/routes/notifications.tsx` (lightweight activity feed sourced from existing recent-attendance data).
- Update `src/router.tsx` so new routes register; create the route files so type-safe `<Link>` works.

Update `src/routes/__root.tsx`:

- Keep the provider-safe `StaticBrandMark` from the recent fix.
- Refine 404 and root-error visuals to the new iOS card style; keep auth-free.

## 4. Splash, landing, auth

- `src/routes/index.tsx` (Landing/Welcome — item #2): cinematic blue-gradient hero with soft blur orbs, large Apple-style headline, stacked feature cards (Clubs, Events, Check-In, Insights), gold "Get Started" primary CTA, "Sign In" secondary. Fully mobile-first, no desktop-leftover layout.
- Add lightweight splash treatment: a brief intro state on `/` for unauthenticated first paint (CSS-only fade, no extra route) implying app launch (item #1).
- `src/routes/sign-in.tsx`, `src/routes/sign-up.tsx`, `src/routes/forgot-password.tsx`, `src/routes/reset-password.tsx`: rebuild as iOS auth cards on a soft tinted canvas — large title, grouped form fields, single primary CTA, calm trust footer. Logic untouched.
- Refresh `src/components/attendance-hq/host-onboarding.tsx` `AuthShell`/`AuthCard`/`OnboardingShell`/`FormCard`/`ProgressIndicator` to the new iOS material system (rounded-3xl, soft shadow, blur header, segmented progress dots).

## 5. Onboarding (host first-run)

- `src/routes/onboarding.club.tsx` and `src/routes/onboarding.event.tsx`: convert to a paged iOS onboarding feel — large title per step, grouped inset form sections, university selector styled as an iOS picker row, sticky bottom primary CTA respecting safe area.

## 6. Home / host dashboard (item #7)

Rebuild the Home tab as the crown jewel. Reuse existing host data sources but present them in an Apple command-center layout:

- Large title "Hello, [first name]" with subdued date subhead and bell icon for notifications.
- Active event highlight card (gold-edged if live), tappable to event detail or live view.
- Stat tiles row: Events this week, Total check-ins today, Active clubs, scrollable horizontally with snap.
- Action tile cluster (2x2 grid): Create Event, Show QR, View Live, View Roster.
- Recent activity grouped list (recent check-ins / recently created events).
- Implemented as either an enriched home route or by promoting `src/routes/events.index.tsx` to be the Home content surface; choose to add a new `src/routes/home.tsx` and re-route the bottom-tab Home there to keep `events.index.tsx` focused on the Events tab.

## 7. Clubs experience

- `src/routes/clubs.index.tsx` (Clubs list — item #8): iOS large title, search field styled as iOS rounded search, segmented filter (All / By university), grouped list of club cards with university chip, member/event counts, chevron rows. Floating "+" pill for create.
- New club creation flow (item #9): refresh the existing `ClubDialog` in `src/components/attendance-hq/host-management.tsx` to render as an iOS bottom sheet on mobile, with grouped form rows and required university selector styled as an iOS picker.
- `src/routes/clubs.$clubId.tsx` (Club detail — item #10): hero header with club avatar/initials, university badge, stat tiles, quick actions (New Event, View Roster, Edit), recent attendance preview list.
- Edit club (item #11): same bottom sheet treatment with destructive zone styled as a tasteful red list row.

## 8. Events experience

- `src/routes/events.index.tsx` (item #12): segmented control (Upcoming / Live / Past), iOS event cards with date block on the left, status pill, attendance count, club + university meta, floating create CTA. Preserve current data flows.
- `src/routes/events.new.tsx` (item #13): grouped iOS form — Club picker (with inferred university shown as read-only meta row), date/time pickers styled as iOS rows, location field, description, sticky bottom Create CTA.
- `src/routes/events.$eventId.tsx` (item #14): Apple Calendar–style hero header with title, club/university, time, status pill. Action grid: Open Check-In, Show QR, View Roster, Edit. Attendance summary tiles and recent check-ins list.
- `src/routes/events.$eventId.edit.tsx` (item #15): same iOS form structure as create, plus tasteful destructive zone (close/archive event).
- `src/routes/events.$eventId.display.tsx` (QR display — item #16): dramatic Apple Wallet–pass treatment: dark blue gradient backdrop, centered white rounded-3xl card with the QR, event identity above, Share / Save / Open Link actions. Full-bleed mobile.

## 9. Public student check-in (items #17–#21)

Restyle `src/components/attendance-hq/public-check-in.tsx` and `src/routes/check-in.$qrToken.tsx` while preserving the recently shipped university-scoped progressive flow:

- Event identity header as a premium card (event title, club, university, date/time pill).
- State 1 (Lookup): large title "Check in", single iOS-style 900 number field with numeric keypad hint, gold pill primary CTA "Find My Account".
- State 2A (Returning): warm confirmation card with name + masked email, "Check Me In" primary, "Not Me" secondary.
- State 2B (First-time): grouped form (first name, last name, student email, prefilled 900), single primary CTA "Create Account & Check In".
- State 3 (Success): SuccessBurst visual, "You're Checked In", student + event meta, subtle timestamp.
- Already-checked-in: identical success language with "Already checked in at [time]" subhead — never an error wall.
- Blocked / not-found event: calm iOS empty state, no harsh red.

## 10. Roster, analytics, live, notifications, settings

- Attendance roster (item #22): add an iOS roster view inside the event detail (or as a sub-route) with iOS search bar, grouped rows (avatar initial + name + email + check-in time), fast scan layout. Reuse existing roster data from `attendance-hq.functions.ts`.
- Attendance analytics (item #23): a section on event detail with Apple-style metric tiles (Total, Unique, Velocity) plus a simple sparkline/bar block built with existing chart primitives — minimal, clean, no heavy dashboards.
- Live event ops (item #24): new `src/routes/live.tsx` showing the host's currently live event with live attendance count, QR quick access button, recent activity feed, sticky bottom action strip (Show QR / Open Roster / End Event). Empty state when no live event.
- Notifications (item #25): new `src/routes/notifications.tsx` rendering recent attendance + event milestones as an iOS grouped activity feed sourced from existing data.
- Settings (item #26): new `src/routes/settings.tsx` with Apple Settings grouped layout — profile row (avatar, name, email), Organization section, Preferences (theme placeholder, notifications), Security (change password link), Sign out as a destructive list row.

## 11. Implementation safeguards

- No schema or server-function changes. All data flows continue through existing TanStack server functions in `src/lib/attendance-hq.functions.ts`.
- Preserve university-scoped check-in logic, remembered-device behavior, RLS, and uploaded-logo upload/render flow.
- Keep `__root.tsx` fallbacks provider-independent (no `useAttendanceAuth` in error/404 components).
- Do not edit `src/integrations/supabase/client.ts`, `src/integrations/supabase/types.ts`, `src/routeTree.gen.ts`, or `.env`.
- Mobile viewport (390px) is the primary canvas; ensure 375 and 430 also look correct. Tablet/desktop should scale gracefully but are not the design target.

## 12. Validation pass

After implementation, verify on a 390px viewport:

- `/`, `/sign-in`, `/sign-up`, `/forgot-password`, `/reset-password`
- `/onboarding/club`, `/onboarding/event`
- `/home` (new), `/clubs`, `/clubs/$clubId`, `/events`, `/events/new`, `/events/$eventId`, `/events/$eventId/edit`, `/events/$eventId/display`
- `/live` (new), `/notifications` (new), `/settings` (new)
- `/check-in/$qrToken` across all four progressive states + already-checked-in + blocked

Check for: large-title hierarchy, grouped surfaces, soft depth, frosted bottom tab bar, gold CTA restraint, safe-area padding, and that every screen feels like one cohesive iOS product. Run `bunx tsc --noEmit` after the pass.

