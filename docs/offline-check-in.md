# Offline-tolerant student check-in

## What we ship

- **Online/offline hook** (`src/hooks/use-online-status.ts`) — reads
  `navigator.onLine` and subscribes to `online`/`offline` events. Also
  exports `isLikelyOfflineError` for classifying thrown server-fn
  errors as transport failures vs. real domain responses.
- **Draft persistence** — on `/check-in/$qrToken`, first-time
  (`firstName`, `lastName`, `studentEmail`, `nineHundredNumber`) and
  returning (`nineHundredNumber`) drafts are stored in
  `sessionStorage` keyed by `qrToken`
  (`ahq:checkin-draft:${qrToken}` / `ahq:checkin-return-draft:${qrToken}`).
  Drafts restore on mount and are cleared on successful check-in.
  We use `sessionStorage`, not `localStorage`, so drafts do not
  outlive the browser tab.
- **Offline banner** — a compact `OfflineBanner` renders on
  first-time, returning, and confirm screens whenever
  `navigator.onLine === false` **or** the last submit threw a
  transport-shaped error (`TypeError`, `Failed to fetch`,
  `NetworkError`). Submit buttons are disabled while offline and
  labeled "You're offline".
- **Error classification** — `getPublicCheckInErrorMessage` now
  emits a dedicated offline/network message when the error looks
  network-shaped; rate-limit and university-email copy are
  unchanged.
- **Retry UX** — after a failed submit the student stays on the
  same screen with values intact. When `online` flips back to true
  after being false, a soft `sonner` toast reads
  "Back online — you can check in now." No auto-submit.

## What we deliberately do NOT ship

- **No offline write queue / background sync.** Attendance writes
  stay online and server-authoritative. Any offline attempt is a
  no-op that leaves the form intact for the student to retry.
- **No IndexedDB outbox.** Rate limits and dedupe rules assume a
  live connection; a background auto-POST could double-check-in a
  student who scanned twice with the app in the background.
- **No custom service worker for the check-in shell.** The Lovable
  PWA skill flags SW registration in preview / iframe contexts as
  a real footgun (stale HTML, stuck chunks). Manifest-based
  installability is already in place; adding a hand-written or
  vite-plugin-pwa app-shell worker for this route would add more
  operational risk than it removes for a page that fundamentally
  cannot function without the server. If offline shell rendering
  is later required, follow `skill/pwa` — do not hand-roll a
  worker.

## Rate limits — unchanged

All rate limits enforced by `assertRateLimit("register", qrToken)`
and per-IP budgets in `src/lib/rate-limit.server.ts` remain in
force. The offline UX does not retry automatically and does not
weaken any budget.
