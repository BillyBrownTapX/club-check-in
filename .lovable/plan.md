
Build Attendance HQ as a mobile-first QR attendance product with two clearly separated experiences: a public check-in flow for students and a clean authenticated host workspace for club officers.

1. Product foundation
- Replace the placeholder home page with a lightweight marketing landing page for Attendance HQ.
- Set the product branding, metadata, and copy for attendance-hq.com.
- Establish a restrained SaaS design system: soft radii, neutral surfaces, strong spacing, bold primary actions, and clear success/error states.
- Prioritize phone-first layouts for all public check-in screens before polishing host dashboards.

2. Authentication and host onboarding
- Add host authentication with sign up, sign in, and forgot password pages using a shared auth shell.
- Store host profile data for signed-in officers.
- After sign-up, route new hosts into a simple first-run setup that helps them create their first club immediately.
- Protect host routes so only authenticated hosts can access the dashboard, clubs, events, and event operations pages.

3. Data model and operational rules
- Create the production-minded schema for host profiles, clubs, event templates, events, students, attendance records, attendance actions, and student device sessions.
- Enforce the required constraints: unique QR token, unique 900 number, one attendance record per student per event, proper indexes, timestamps, and validation rules.
- Apply row-level security so hosts only access their own clubs, events, templates, and related attendance data.
- Keep roles structured safely for future expansion without bloating this MVP.

4. Public mobile check-in flow
- Build `/check-in/:qrToken` as the centerpiece experience with a clean public shell, strong event context, and large tap-friendly action choices.
- Show the event info card with club, event, date, time, location, and clear check-in status.
- Offer three possible entry paths:
  - first-time check-in
  - returning student lookup
  - remembered-device fast path when available
- Keep the flow single-column, minimal, and fast on phones with one clear action per screen.

5. First-time student registration and check-in
- Build a dedicated first-time check-in screen with large full-width fields for first name, last name, student email, and 900 number.
- Use inline validation, direct error copy, numeric keypad input for the 900 number, and a strong full-width “Save and Check In” CTA.
- Prevent duplicate student creation through the 900 number rule.
- On submit, create the student record, record attendance, optionally remember the device, and route to a confidence-building success screen.

6. Returning student flow
- Build a minimal returning lookup screen focused on entering a 9-digit 900 number.
- If a student is found, show an identity confirmation screen with masked email and a full-width “Check In” CTA.
- Only write attendance after the user confirms.
- Support a remembered-device fast path that still requires one explicit confirmation tap for trust and speed.

7. Success, blocked, and error states
- Create polished reusable state screens/cards for:
  - invalid link
  - event not found
  - check-in not open yet
  - check-in closed
  - already checked in
  - student not found
  - invalid 900 number
- Make each state obvious immediately with a short explanation and the best next action.

8. Host app shell and core navigation
- Build a clean responsive host shell with a simple top header, optional desktop sidebar, and uncluttered content area.
- Keep mobile host navigation compact and avoid heavy enterprise patterns.
- Add the required routes: dashboard, clubs, club detail, events, event detail, and QR display mode.

9. Host dashboard
- Create a scannable dashboard with KPI cards, quick actions, upcoming events, recent events, and club overview.
- Make the page readable in seconds on mobile and desktop.
- Surface the fastest next actions: create club, create event, create template.

10. Clubs and templates
- Build the clubs list page with create CTA and responsive club cards.
- Build the club detail page with header, quick actions, quick stats, upcoming events, past events, and event templates.
- Add a tight event template workflow: create, edit, duplicate, and use template for event creation.
- Keep templates clearly useful but secondary to event operations.

11. Event creation flow
- Build a clean create-event flow that supports:
  - from scratch
  - from template
  - duplicate a previous event
- Collect the required event fields and generate a unique QR token automatically.
- Redirect directly to the event detail page after creation so hosts can immediately operate the event.

12. Event detail as the host operations center
- Make `/events/:eventId` the primary host operations screen.
- Include event summary, status, attendance count, action row, and a live attendee list.
- Add strong host actions:
  - open QR display mode
  - copy check-in link
  - export attendance
  - edit event
  - duplicate event
  - close check-in early
- Provide search over attendee records and allow mistaken attendance removal with correction logging.
- Do not build full manual attendance add yet, but leave the page structure ready for it later.

13. QR display mode
- Build `/events/:eventId/display` as a large, high-contrast QR presentation page.
- Show club name, event name, large centered QR, and a short “Scan to check in” instruction.
- Keep the screen minimal and readable from a distance on tablets, laptops, and projectors.

14. Events page
- Build a manageable events index with simple filters for club, date, and status.
- Show event cards or rows with event name, club, date/time, location, attendance count, and manage action.
- Keep mobile stacked and readable; enhance desktop only when it improves scanning.

15. Real-time event activity
- Update attendance counts and attendee lists live where feasible.
- Use realtime updates or graceful refresh behavior so the event detail page feels operational during live check-in periods.
- Make the newest check-ins appear quickly without requiring heavy page reload behavior.

16. CSV export and empty states
- Add CSV export from event detail with the required attendance fields.
- Build polished empty states for no clubs, no events, no templates, no attendance, no student found, invalid event, and no upcoming events.
- Keep copy short, direct, and action-oriented.

17. Quality and launch readiness
- Validate all forms carefully, especially public student inputs.
- Enforce the event check-in window, duplicate attendance prevention, and host ownership boundaries.
- Ensure public student data exposure stays minimal.
- Make the full product responsive, but spend the most polish on the student phone flow.
- After implementation, test the full journey end to end: sign-up → create club → create event → open QR → first-time check-in → returning check-in → host sees live attendance → export CSV.
