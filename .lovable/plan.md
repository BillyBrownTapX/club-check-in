# Persistent attendee check-in — remember me on this device

Goal: after someone checks in once on a phone, every future event is Scan → "Welcome back, Billy" → one tap. No accounts, no passwords, no re-typing.

## What already exists (verified)

- The device already gets a random token saved in the browser after a first check-in, and the server maps that token to the attendee. No new tables are needed.
- The database already keeps "saved my spot" and "actually attended" as separate records, and already refuses to create a second attendance record for the same person at the same event.
- Device tokens are unique and already expire (180 days old / 90 days unused).

So this work order is about the attendee experience, not new plumbing.

## Gaps to close

1. **Form flashes before recognition.** Today the information form renders first, then the "welcome back" card appears above it. Replace with a brief "Loading check-in…" state, then the correct screen.
2. **Two taps instead of one.** A recognized attendee currently gets a "Is this you?" confirmation screen before check-in. Make the welcome-back screen check them in directly on one tap.
3. **Pre-registered state is missing.** If a recognized attendee already saved their spot for this event, show "You're already registered" with an **I'm Here** button, which converts that existing record to attended without creating a duplicate.
4. **Already-checked-in state is unfriendly.** Repeat scans land on a generic blocked card. Show "You're already checked in" with the event name and the time they checked in.
5. **No "Not Billy?" escape.** Add a low-key "Not Billy?" action on every recognized screen: it forgets the device identity and shows the normal form.
6. **No way to fix stored details.** Add a quiet "Update my information" action that opens the form prefilled with their current saved name and email, and updates their existing profile.
7. **Pre-registration page doesn't recognize returning attendees.** It saves the device identity but never uses it. Add the same welcome-back one-tap **Save My Spot**.
8. **Wording.** Attendee-facing buttons become **Save My Spot** (before the event), **I'm Here** (already registered), **Check Me In** (no prior registration). Host-side wording stays as-is.

## Technical notes

- Extend the existing remembered-device lookup so one server call returns: attendee first name + masked email, and their state for this event — `none`, `pre_registered` (with saved-at time), or `checked_in` (with check-in time). One round trip drives the whole screen choice.
- Add a public server function to convert a pre-registration to attendance, resolved from the device token server-side, reusing the existing duplicate-safe attendance insert (so double taps, refreshes, and retries all resolve to the same single record). Simply opening the page never converts anyone.
- Add a public server function to update the attendee's own name/email, authorized only by the device token. The 900 number stays read-only since it is the identity key; email keeps the existing university-domain check.
- Rework `src/routes/check-in.$qrToken.tsx` state machine: `recognizing → recognized (none | pre_registered | checked_in) | first-time | returning | edit-profile | success | blocked`. Keep the existing offline banner, draft persistence, rate limits, and sanitized error copy.
- Mirror the recognized path in `src/routes/pre-check-in.$preToken.tsx`.
- Every recognized-path button disables while its request is in flight; success is only shown after the server confirms.
- Invalid or expired tokens: clear silently, fall back to the form, never show technical errors.
- No changes to QR URLs, existing event links, host dashboards, rosters, exports, or metrics.

## Verification

Walk the eight acceptance scenarios in the preview on a mobile viewport: new attendee, same attendee at a second event, pre-registered → I'm Here, repeat scan, "Not Billy?", invalid stored token, rapid double tap, and refresh mid-check-in — confirming no duplicate records in the database each time.
