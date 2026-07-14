## Goal
Make the "Display" action open a **public, no-login page** built for TVs/projectors. Anyone with the URL can see the event's name, times, live check-in count, and a big scannable QR — no host account required.

## Why the current page doesn't work for this
The current `/events/$eventId/present` route:
- Calls `useRequireHostRedirect()` → bounces logged-out visitors to sign-in.
- Loads data via `getEventDisplayPayload`, a server function protected by `requireSupabaseAuth` that also requires the caller to *own* the event.

So a TV signed into nothing, or a laptop plugged into an AV cart, currently can't render it.

## Changes

### 1. New public server function `getPublicEventDisplay`
File: `src/lib/attendance-hq.functions.ts`

- `createServerFn({ method: "GET" })` with **no auth middleware**.
- Input: `{ qrToken: string }` (Zod-validated). We key by `qr_token` — same capability model the public check-in flow already uses — instead of the internal event UUID.
- Uses the admin client (loaded inside the handler) to read only these public fields:
  - event: `event_name`, `event_date`, `start_time`, `end_time`, `check_in_opens_at`, `check_in_closes_at`, `is_active`, `is_archived`, `qr_token`
  - club: `club_name`
  - `attendanceCount` (head count only)
  - `recent15m` (count of `attendance_records` inserted in the last 15 min)
- Returns **no PII** — no student names, emails, 900 numbers, or IDs. If the event doesn't exist or is archived, returns a `notFound: true` shape so the page can render a friendly "Event unavailable" state.

### 2. New public route `src/routes/display.$qrToken.tsx`
- Path: `/display/$qrToken` (top level, not under `/api/public/*` — that prefix is for HTTP endpoints, not pages).
- `head()`: `robots: noindex, nofollow`, page-specific title.
- **No `useRequireHostRedirect`.** Anyone can open it.
- Uses `useQuery` (not `useAuthorizedQuery`) calling `getPublicEventDisplay` with `{ qrToken }`.
- Auto-refresh every 15 s via `refetchInterval` for the live counter (realtime channels aren't reliably reachable anonymously, so we use lightweight polling instead).
- Layout: reuse the large-screen composition from `events.$eventId.present.tsx` — giant event title, date/time, giant QR encoding `${origin}/check-in/${qrToken}`, big "Checked in" counter, "Last 15 min" delta, live/upcoming/closed status pill, fullscreen toggle.
- Removes the "Back" button and any host-only controls so it's safe to leave on a TV.

### 3. Wire the Display button
File: `src/routes/events.$eventId.tsx`

- "Display / Project to TV" `ActionTile` → link to `/display/$qrToken` using the event's `qr_token`.
- Open in a new tab (`target="_blank"`) so the host's admin session on the current tab is untouched when the URL is copy-pasted onto a TV browser.
- Also update the "Full screen" button inside the "Show QR" modal to point at the same public URL.

### 4. Retire the private `/present` route
- Delete `src/routes/events.$eventId.present.tsx` (added in the previous turn) since `/display/$qrToken` fully replaces it.
- Keep the existing wallet-style `/events/$eventId/display` mobile page — it's a different, host-only surface and still used elsewhere.

## Security notes
- `qr_token` is already the public capability for check-in; exposing it on a display URL doesn't broaden the attack surface. Anyone who could scan the QR already had it.
- The new server fn returns **only aggregate counts and non-PII event metadata**. It does not accept an event UUID, so it can't be used to enumerate other events' rosters.
- No writes. Read-only handler.
- Rate limiting: reuse the existing public rate-limit helper (`src/lib/rate-limit.server.ts`) keyed by IP + qr_token so a leaked URL can't be used to hammer the DB.

## Verification
1. Sign out completely, open `/display/<qr_token>` in an incognito window → page renders with QR, title, counter. No redirect to `/sign-in`.
2. Scan the QR from a phone → lands on the existing `/check-in/$qrToken` flow.
3. Complete a check-in → within ~15 s the counter on the display page increments.
4. Open a non-existent or archived event's qr_token → friendly "Event unavailable" state, not a crash.
5. Confirm no student names/emails appear in the Network response for `getPublicEventDisplay`.
