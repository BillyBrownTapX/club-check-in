# Why your phone still isn't recognized — and the fix

## What I checked

- Every attendee in the database who has ever checked in or saved a spot has at least one remembered-phone marker (53 of 53), and none are expired or idle-aged out. So the storing side works and nothing has been cleaned up.
- The recognition step itself is now wired on both the early page and the event-day page, and both read the same marker from the same phone storage.

## The actual gap

A marker is only ever created on **one** path: the first-time form for a person the system has never seen before. Every other way you can finish a check-in leaves the phone anonymous:

- Event-day page: if your 900 number already exists (you attended any earlier event), the form stops and hands you to the "is this you?" shortcut. Finishing that way records attendance but **never** saves a marker on the phone.
- Event-day page: if you were already checked in or already saved your spot, the submit returns early — again no marker.
- Early page: finishing with just your 900 number saves no marker either.

Since your 900 number already existed from earlier events, that's the path your phone took — so it was never remembered, and there was nothing for the recognition step to find.

Second, smaller issue: the "last used" stamp is only refreshed when you tap the one-tap button. A phone that gets recognized but doesn't tap can eventually age out at 90 days for no good reason.

## Fix

1. Save the remembered-phone marker on **every** path that ends with a known person, not just brand-new people:
   - event-day: the 900-number shortcut, and the already-checked-in / already-registered outcomes
   - early page: the 900-number path and the already-saved outcome
2. Refresh the "last used" stamp whenever a phone is successfully recognized, so active phones never age out.
3. Keep behavior as you chose: recognition shows "Welcome back" with a single button. Opening a link never marks you present on its own.
4. Never create a second person record — the marker always points at the existing person, matched by their 900 number within their university.

## Technical notes

- `src/lib/attendance-hq.functions.ts`: extract a small `issueDeviceSession(studentId)` helper; call it from `confirmReturningStudent`, `lookupStudent`'s already-checked-in return, `submitStudentCheckIn`'s `student_exists` / `already_checked_in` returns, `submitReturningPreCheckIn`, and `submitPreCheckIn`'s `already_pre_checked_in` return. Each returns `deviceToken` in its response shape.
- `getRememberedStudent` and `getRememberedPreCheckInStudent`: bump `last_used_at` on a successful resolve.
- `src/routes/check-in.$qrToken.tsx` and `src/routes/pre-check-in.$preToken.tsx`: persist `deviceToken` from those additional responses (the existing `applyResult` already does this where the field is present).
- No schema change, no new tables, no change to QR links, rosters, exports or metrics. Duplicate protection stays as-is.

## Verification

Typecheck, then in a mobile preview: check in with an existing 900 number via the shortcut, reload the link, and confirm the page comes back as "Welcome back" with one button — and that the database still holds exactly one attendance row for that person and event.
