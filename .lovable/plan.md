
Build the public student check-in flow as a dedicated mobile-first route set centered on `/check-in/$qrToken`, reusing the existing backend foundation but isolating the UI from host features.

1. Route structure and page ownership
- Add a new TanStack route file for `/check-in/$qrToken`.
- Keep the student flow self-contained in this route with internal screen state for:
  - event entry
  - first-time registration
  - returning lookup
  - identity confirmation
  - success
  - blocked/error states
- Leave host routes untouched in this task.
- Replace the placeholder `/` page with a minimal landing page only as needed to keep the app valid, but keep implementation effort focused on the public check-in experience.

2. Public mobile component system
- Refactor the existing shared primitives into purpose-built student flow components:
  - `PublicCheckInShell`
  - `EventInfoCard`
  - `ActionChoiceCard`
  - `CheckInFormCard`
  - `IdentityConfirmationCard`
  - `SuccessStateCard`
  - `ErrorStateCard`
  - `StatusBadge`
  - `PrimaryButton`
  - `SecondaryTextButton`
  - `MobileInputField`
  - `MobileNumericField`
- Tighten the mobile UI styling:
  - single-column only
  - max width around phone form width
  - large headings
  - 48px+ CTA height
  - larger inputs than current shared `Input`
  - calmer neutral surfaces and softer radii
- Keep desktop as the same mobile layout with slightly wider breathing room, not a new layout.

3. Loader and event resolution
- Use the existing `getPublicEventByQr` server function from the route loader.
- Add route-level error and not-found handling so invalid tokens and missing events render polished in-app states instead of generic failures.
- Normalize event availability into clear public states:
  - invalid link
  - event not found
  - check-in open
  - not open yet
  - closed
  - closed early / inactive
  - archived/unavailable

4. Entry screen behavior
- Render the event info card first with:
  - club name
  - event name
  - date
  - time
  - location
  - status badge
- Below that, show:
  - heading: “Check in for this event”
  - short instruction text
  - full-width action cards
- Primary actions:
  - first-time flow
  - returning flow
- Optional remembered-device fast path:
  - show only when a local device token exists and a matching remembered session is found for the event/student context
  - still route to an explicit confirmation step before attendance is written

5. First-time registration screen
- Build a dedicated form using `react-hook-form` + `zodResolver` with the existing `studentRegistrationSchema`.
- Use mobile-optimized input wrappers with:
  - visible labels
  - large tap targets
  - numeric keypad for 900 number
  - short inline error messages
- Copy:
  - heading: “First-time check-in”
  - concise supporting text only
- CTA:
  - full-width “Save and Check In”
- Secondary action:
  - lighter text button back to returning flow

6. Returning lookup screen
- Build a minimal single-input screen around the 900 number.
- Validate client-side with the existing `returningLookupSchema`.
- Keep copy extremely short:
  - heading: “Returning check-in”
  - subtext: “Enter your 900 number to continue”
- CTA:
  - full-width “Continue”
- Fallback:
  - lighter text button to first-time flow

7. Identity confirmation flow
- After returning lookup success, show a dedicated confirmation step using masked email and short name.
- For remembered-device fast path, show the same confirmation pattern with “Check in as …” on entry, but still require tapping “Check In”.
- Do not write attendance until the confirmation CTA is tapped.
- Secondary action returns to the previous selection/lookup state.

8. Success and error states
- Build consistent state-card UI for:
  - invalid check-in link
  - event not found
  - check-in not open yet
  - check-in closed
  - already checked in
  - student not found
  - invalid 900 number
- Build a separate success screen with:
  - strong success state icon
  - “You’re checked in”
  - confirmation details card
  - exact check-in timestamp
  - “Done” CTA returning to the event entry state or dismissing to the route base state

9. Server-function hardening for public check-in
- Refactor the existing public check-in server functions to enforce business rules consistently on the server, not only in UI:
  - validate event exists and is active
  - enforce check-in window using `check_in_opens_at` and `check_in_closes_at`
  - prevent duplicate attendance for the same event/student
  - return structured result states instead of raw DB errors where possible
- Update:
  - `studentCheckIn`
  - `lookupStudent`
  - `confirmReturningStudent`
  - `fastCheckIn`
- Ensure lookup only returns minimal student data needed for confirmation:
  - id
  - first name
  - last initial or last name for client formatting
  - masked/confirmable email data only
- Preserve exact timestamp storage on successful check-in.

10. Remembered-device behavior
- Complete the unfinished remembered-device logic:
  - on first-time success, create or upsert a `student_device_sessions` row when `rememberDevice` is true
  - store the generated local device token in browser storage using the existing `DEVICE_TOKEN_KEY`
  - on entry, if a token exists, resolve whether it maps to a valid remembered student session
- Keep this flow private and minimal:
  - no unnecessary student data exposed
  - still requires explicit confirmation before check-in

11. Data and security details
- Keep all validation both client-side and server-side with Zod-backed schemas.
- Do not expose full student records publicly.
- Handle duplicate 900 numbers in first-time flow gracefully:
  - if the 900 number already exists, route the user into confirmation or show a clear “already used before” path instead of crashing
- Use the existing backend tables where possible.
- If current public flow needs better remembered-device lookup support, add a small backend change in a migration rather than weakening security.

12. Technical implementation details
- Create the route before linking to it so TanStack route typing stays valid.
- Add route-specific `head()` metadata for `/check-in/$qrToken`.
- Keep route loader + component error boundaries in place.
- Prefer static imports and existing UI/form utilities.
- Avoid editing generated route tree or auto-generated backend client files manually.

13. QA and acceptance checks
- Verify the mobile flow end to end:
  - valid event loads from QR token
  - first-time registration succeeds
  - returning lookup requires confirmation
  - remembered-device path still requires confirmation
  - duplicate check-ins show the correct state
  - not-open and closed events block correctly
  - invalid token and student-not-found states render cleanly
- Check responsiveness at phone widths first, then confirm it still looks intentional on tablet/desktop without introducing multi-column patterns.

14. Expected deliverable
- A polished launch-ready student-facing flow at `/check-in/$qrToken` with:
  - fast event entry
  - first-time registration
  - returning lookup
  - identity confirmation
  - success state
  - blocked/error states
  - optional remembered-device fast path with explicit confirmation
- No host dashboard, club CRUD, analytics, or unrelated screens included in this implementation batch.
