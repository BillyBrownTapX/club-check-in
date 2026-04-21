
Build the host onboarding flow as a guided activation path that starts at authentication and ends at the newly created event detail page, without exposing hosts to empty states or unrelated dashboard complexity.

1. Authentication foundation
- Add dedicated routes for `/sign-up`, `/sign-in`, and `/forgot-password`.
- Add the required public `/reset-password` route to complete password recovery correctly.
- Use the existing `host_profiles` table and auth listener pattern already present in the app.
- Because the required behavior is “start immediately,” configure sign-up so new hosts can continue directly into onboarding without waiting on email verification.

2. Shared onboarding UI system
- Create purpose-built onboarding components:
  - `AuthShell`
  - `AuthCard`
  - `OnboardingShell`
  - `ProgressIndicator`
  - `FormCard`
  - `PageHeadingBlock`
  - `PrimaryButton`
  - `SecondaryTextLink`
  - `TextInput`
  - `EmailInput`
  - `PasswordInput`
  - `DateInput`
  - `TimeInput`
  - `InlineErrorMessage`
  - `SuccessBanner`
- Keep all onboarding forms single-column, centered, touch-friendly, and visually consistent with the existing premium restrained design system.
- Reuse the product logo and neutral styling already established in `primitives.tsx` and `styles.css`.

3. Auth page behavior
- `/sign-up`
  - Show full name, email, and password.
  - Submit through a host sign-up flow that creates the auth user and ensures the host profile exists.
  - Automatically sign the new host into the app client-side and route immediately to `/onboarding/club`.
- `/sign-in`
  - Show email and password with clear support links.
  - On success, route based on onboarding state:
    - no clubs → `/onboarding/club`
    - has club but no events → `/onboarding/event`
    - fully onboarded → dashboard or primary host landing page
- `/forgot-password`
  - Collect email and send reset link.
  - Keep the page minimal and confirmation-focused.
- `/reset-password`
  - Let hosts set a new password after following the reset link.
  - Redirect to sign-in or onboarding-aware host routing after success.

4. Onboarding state resolution
- Add a server function to resolve host onboarding status from authenticated data:
  - host profile
  - first club if any
  - first event if any
  - completion state
- Use this status to:
  - guard onboarding routes
  - prevent repeating completed steps
  - send returning hosts to the correct next step
- Add route guards for `/onboarding/club` and `/onboarding/event` so only authenticated hosts can access them.

5. Create first club step
- Add `/onboarding/club` with the shared onboarding shell.
- Show subtle progress: “Step 1 of 2”.
- Keep the form extremely short:
  - club name
  - description optional
- Generate the slug automatically from club name on the server.
- On success:
  - create the club linked to the authenticated host
  - route immediately to `/onboarding/event`
- If the host already has a club, redirect forward instead of showing a redundant form.

6. Create first event step
- Add `/onboarding/event` with the same onboarding shell.
- Show subtle progress: “Step 2 of 2”.
- Preload the host’s first club from onboarding status instead of asking them to choose a club.
- Use a focused form for:
  - event name
  - event date
  - start time
  - end time
  - location
  - check-in opens at
  - check-in closes at
- Add smart defaults:
  - when start time is chosen, suggest check-in opens 15 minutes before
  - suggest check-in closes 20 minutes after start
  - keep both values editable
- On success:
  - create the event with a unique QR token
  - redirect directly to `/events/:eventId`
  - pass a success banner/toast message such as “Your event is ready. Open the QR code to start check-in.”

7. Routing and handoff logic
- Keep `/events/:eventId` as the onboarding destination rather than adding a separate success page.
- Add lightweight redirect helpers so:
  - authenticated hosts visiting `/sign-in` or `/sign-up` are forwarded appropriately
  - hosts without a club go to `/onboarding/club`
  - hosts with a club but no event go to `/onboarding/event`
  - fully onboarded hosts land on the main host area
- Preserve redirect-back behavior for protected host routes after sign-in where useful.

8. Server-side changes
- Refactor auth-related server functions so onboarding works with real session behavior, not just account creation:
  - keep password reset server support
  - add onboarding status server function
  - ensure club creation and event creation can be used cleanly inside onboarding
- Harden creation flows to return structured validation and ownership-safe results.
- Ensure club/event creation always uses the authenticated host context and never trusts client-provided ownership data.
- Confirm host profile creation is resilient:
  - rely on the existing trigger where possible
  - add a safe recovery path if profile lookup fails after sign-up

9. Form validation and UX details
- Reuse Zod-based schemas where they already fit.
- Add any missing auth schemas or onboarding-specific client validation.
- Show inline errors only; no browser alerts.
- Keep one clear primary CTA per screen.
- Use larger inputs and buttons than generic admin forms so onboarding feels deliberate and easy on mobile/tablet.

10. Route metadata and boundaries
- Add route-specific `head()` metadata for sign-up, sign-in, forgot password, reset password, onboarding club, and onboarding event.
- Add error and not-found handling for any onboarding route using loaders.
- Keep the TanStack Start router structure intact and avoid editing generated route files manually.

11. Technical details
- New route files to add:
  - `sign-up.tsx`
  - `sign-in.tsx`
  - `forgot-password.tsx`
  - `reset-password.tsx`
  - `onboarding.club.tsx`
  - `onboarding.event.tsx`
  - optionally an authenticated layout route for host-only onboarding guards
- Likely supporting additions:
  - onboarding/auth components file
  - onboarding routing helpers
  - new server function for onboarding status
- Update the auth provider only as needed to expose enough session state for route decisions and client redirects.

12. Backend and auth configuration work required
- Since immediate onboarding after sign-up is required, update backend auth settings to allow that flow.
- If email verification remains enabled today, change the configuration so new hosts can proceed directly after account creation.
- No new data tables are required for this onboarding scope; existing `host_profiles`, `clubs`, and `events` support it.

13. Acceptance checks
- New host can:
  - sign up
  - enter `/onboarding/club`
  - create first club
  - create first event
  - land directly on `/events/:eventId`
- Returning host behavior:
  - no club → `/onboarding/club`
  - has club, no event → `/onboarding/event`
  - fully onboarded → main host landing page
- Forgot/reset password flow works end-to-end.
- Mobile, tablet, and desktop layouts remain clean, single-column at the form core, and visually guided.
- No host is dropped onto an empty generic dashboard immediately after sign-up.

14. Deliverable
- A polished activation funnel for hosts that covers:
  - sign-up
  - sign-in
  - forgot/reset password
  - create first club
  - create first event
  - progress indication
  - onboarding-aware redirects
  - direct handoff into the event detail experience
- The result should feel like guided setup into live value, not generic auth plus blank application state.
