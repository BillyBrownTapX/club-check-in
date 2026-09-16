# Why the early check-in page doesn't recognize you

## What's going on

The early ("save my spot") page and the event-day check-in page were built separately, and only the event-day page ever got the "remember me on this phone" behavior.

Verified in the code:

- The early page **saves** a device marker on your phone after you fill the form once (`pre-check-in.$preToken.tsx`, line 128).
- It never **reads** that marker back. There is no recognition step on load, so it always shows the blank form.
- The server side is also unfinished: the two pieces the early page would need — "who is this phone?" and "save this person's spot in one tap" — were named during the last work order but never written. Only the event-day equivalents exist.

So nothing is broken or misconfigured; the returning-attendee half of this page was simply never implemented.

One thing worth flagging: even once it works, opening the page should not silently save your spot for you. Recognition should show "Welcome back, Billy" with a single **Save My Spot** button, so the head count only counts people who actually tapped. Auto-submitting on page open would inflate the count for anyone who merely opens the link.

## Fix

1. Add the two missing server actions:
   - recognize a phone against this upcoming event and report its state: not registered yet, already registered (with the time), or already checked in.
   - save the spot in one tap, resolved from the phone marker on the server, reusing the existing duplicate-safe insert so double taps and refreshes resolve to the same single record.
2. Add a brief "Loading…" gate on the early page so the blank form never flashes before recognition finishes.
3. Recognized screens on the early page:
   - not registered → "Welcome back, Billy" + **Save My Spot**
   - already registered → "You're already saved for this event" with the time
   - already checked in → "You're already checked in"
   - every recognized screen gets a quiet **Not Billy?** action that forgets the phone and shows the normal form.
4. Unknown or expired phone marker → clear it silently and show the normal form, with no technical error text.
5. Buttons disable while the request is in flight; success only shows after the server confirms.

## Technical notes

- New public server fns in `src/lib/attendance-hq.functions.ts`: `getRememberedPreCheckInStudent` and `fastPreCheckIn`, both validated by the existing `rememberedPreCheckInSchema` and wrapped in `withCheckInLog` (op names already in the `PublicCheckInOp` union). Resolve the event via `getEventForPreCheckIn(preToken)`, the attendee via `resolveDeviceSession(deviceToken)`, then check `attendance_records` and `pre_check_ins` for state; `fastPreCheckIn` reuses `insertPreCheckIn` and bumps `last_used_at`.
- `src/routes/pre-check-in.$preToken.tsx`: add `recognizing` to the screen union plus `recognized-none | recognized-registered | recognized-checked-in`, mirroring the structure already in `check-in.$qrToken.tsx`. Keep the existing offline banner, rate limits, counts, and sanitized error copy.
- No schema change, no new tables, no change to existing links, QR URLs, host dashboards, rosters, or exports.
- Verify with `bunx tsgo --noEmit`, then walk the flow in a mobile preview: fresh device, returning device, already-registered device, repeat open, "Not Billy?", invalid stored marker — confirming no duplicate rows.
