
Fix the student QR check-in experience by aligning the public route with the intended first-time registration flow and by handling blocked event windows clearly.

1. What the codebase is doing right now
- The QR code points to `/check-in/$qrToken`.
- That route already exists and loads correctly from `src/routes/check-in.$qrToken.tsx`.
- The student registration form already exists and asks for:
  - first name
  - last name
  - student email
  - 900 number
- Validation is already in place in `src/lib/attendance-hq-schemas.ts`:
  - email must be valid
  - 900 number must be exactly 9 digits
- The server-side public check-in handlers also already exist in `src/lib/attendance-hq.functions.ts`:
  - `studentCheckIn`
  - `lookupStudent`
  - `confirmReturningStudent`
  - `fastCheckIn`
  - `getRememberedStudent`

2. Root cause confirmed from code
There are two separate reasons this appears “not working”:

- The QR route does not go straight to the registration form.
  - In `src/routes/check-in.$qrToken.tsx`, the initial screen is:
    - `entry` when the event is available
    - `blocked` when the event is not available
  - The entry screen shows choices:
    - “First time using Attendance HQ”
    - “I’ve checked in before”
  - So the current product behavior is not “scan QR → immediate registration form”.
  - It is “scan QR → choose path → then see the form”.

- The event may be blocked by the check-in window.
  - Public access is gated by `getEventForPublicCheckInByQr()` in `src/lib/attendance-hq.functions.ts`.
  - That function returns:
    - `not_open_yet` if now is before `check_in_opens_at`
    - `closed` if now is after `check_in_closes_at`, inactive, or archived
  - The current event data shows recent events with fixed check-in windows, so if a student scans outside that window they will never reach the form.

3. Why the student is not being brought directly to the form
- The current UI was built as a branching flow, not a forced first-time flow.
- Specifically in `src/routes/check-in.$qrToken.tsx`:
  - `const [screen, setScreen] = useState<FlowScreen>(initialBlockedState ? "blocked" : "entry");`
- That means scanning a QR code lands on the entry-choice screen by design.
- If the event is outside the allowed time window, it lands on a blocked state instead.

4. What needs to be changed
Update the QR check-in route so first-time students are taken directly to the registration form instead of the chooser screen, while still preserving returning-student and remembered-device paths in a safe way.

5. Implementation plan
- Update `src/routes/check-in.$qrToken.tsx`
  - Change the initial screen logic so that:
    - blocked events still open the blocked screen
    - remembered-device users can still be surfaced when found
    - otherwise the default student experience opens `first-time` directly
  - Replace or reduce the current entry-choice screen so it matches the intended product flow:
    - default: first-time registration form
    - secondary option: link/button for returning students
  - Keep the existing registration form fields and zod validation unchanged.

- Keep the current server-side logic in `src/lib/attendance-hq.functions.ts`
  - The public handlers already support:
    - new student creation
    - returning lookup
    - duplicate attendance protection
    - remembered-device check-in
  - No auth redesign is needed here.

- Improve blocked-state messaging
  - If check-in is not open yet or is closed, keep the blocked screen but make the reason more obvious to students.
  - This prevents “nothing happens” confusion when the real issue is timing, not form failure.

- Review host-side QR expectations
  - The QR URL is generated from `window.location.origin` in:
    - `src/routes/events.$eventId.tsx`
    - `src/routes/events.$eventId.display.tsx`
  - Verify the generated QR route remains correct after the public flow change.

6. Files to update
- `src/routes/check-in.$qrToken.tsx`
  - main UX fix
- Possibly `src/components/attendance-hq/public-check-in.tsx`
  - only if copy or CTA presentation needs minor adjustment
- No database changes required
- No auth changes required

7. Expected result after the fix
- Student scans QR code
- If check-in is open:
  - student is brought directly to the form asking for:
    - first name
    - last name
    - student email
    - 900 student ID number
- Returning students still have a visible fallback path
- Remembered-device flow can still work when available
- If check-in is not yet open or already closed, students see a clear blocked message instead of seeming like the page is broken

8. Validation after implementation
- Scan/open a valid QR link during an open check-in window
  - confirm the registration form appears immediately
- Submit valid first-time student data
  - confirm attendance is recorded
- Submit invalid 900 number
  - confirm the 9-digit validation error appears
- Use a known returning student
  - confirm the returning path still works
- Open the QR link before the event opens
  - confirm a clear “not open yet” state appears
- Open the QR link after it closes
  - confirm a clear “closed” state appears
