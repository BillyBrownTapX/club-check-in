

Bring the host logo back into the iOS-native UI and surface it on both the host's own screens and on the public student check-in / QR display screens.

## What you'll see

1. **On host screens**: a tappable logo badge in the top-right of the Home screen (and on Settings) that shows the uploaded logo, or a default mark if none is set. Tapping it lets the host upload/replace their organization logo. The bigger uploader also lives in Settings under a new "Branding" section.
2. **On the QR display screen** (`/events/$eventId/display`): the host's uploaded logo appears at the top of the Wallet-style pass card, above the club name and event title.
3. **On the public student check-in screen** (`/check-in/$qrToken`): the host's logo appears in the event identity header so students see the organization brand they're checking in to.

## Implementation

### 1. Reusable iOS logo components

In `src/components/attendance-hq/ios.tsx` add two small primitives:

- `HostLogoBadge` — tappable square (44–56px) that renders the host's signed logo URL or a fallback "A" monogram. When `editable` is true, it opens a hidden file input and uploads via the existing flow (extracted from `AttendanceLogo`). Used in headers.
- `HostLogoUploader` — larger Settings-style uploader card with a 96px preview, "Upload logo" / "Replace" / "Remove" actions, and helper text ("PNG, JPG, or WebP — up to 3 MB").

Both reuse the existing `host-logos` Supabase bucket and the existing `host_profiles.logo_url` column. The upload + signed-URL logic is lifted from the current `AttendanceLogo` in `primitives.tsx` so we don't introduce a second code path. `AttendanceLogo` itself stays for backward compatibility but delegates to `HostLogoBadge`.

### 2. Show the logo on host screens

- `src/routes/home.tsx`: add `HostLogoBadge editable` at the leading edge of the top action row (left of the greeting block, balancing notifications/sign-out on the right). Tapping = upload.
- `src/routes/settings.tsx`: add a "Branding" grouped section at the top with `HostLogoUploader`. This is the primary place hosts manage their logo.

### 3. Public logo fetch (no auth, scoped by QR)

The public check-in and public-facing QR display need the logo without exposing host data. Add one new server function in `src/lib/attendance-hq.functions.ts`:

- `getPublicHostBrandingByQr({ qrToken })` — resolves the event by `qr_token` (re-validating the QR capability the same way the existing public functions do), looks up the owning club's `host_id`, fetches that host's `logo_url`, and returns either `{ logoUrl: signedUrl }` (1-hour signed URL from `host-logos`) or `{ logoUrl: null }`. No host PII is returned. Uses `supabaseAdmin` like the other public-by-qr functions. Input validated with the existing `qrTokenSchema`.

Extend the existing `getPublicEventByQr` payload to also include `hostLogoUrl` on its return shape so the public check-in route can grab it in the same load (avoiding a second round-trip). Update `EventWithClub` consumers only where needed; the new field is optional so other consumers are unaffected.

### 4. Show the logo on the public check-in screen

- `src/components/attendance-hq/public-check-in.tsx`:
  - `PublicCheckInShell` header: replace the small `BrandMark` with the host's logo when `hostLogoUrl` is provided (passed from the route), falling back to `BrandMark`.
  - `EventInfoCard`: add an optional `hostLogoUrl` prop and render a 40px rounded logo tile in the top-left of the card above/next to the club name.
- `src/routes/check-in.$qrToken.tsx`: pass `hostLogoUrl` (from the extended `getPublicEventByQr` payload) into `PublicCheckInShell` and `EventInfoCard`.

### 5. Show the logo on the QR display screen

- `src/routes/events.$eventId.display.tsx`: this screen is host-authenticated, so it can use `HostLogoBadge` (non-editable, larger size ~56px) directly. Render it in the gradient pass header above the club name and event title, centered, with subtle white ring to match the Wallet-pass aesthetic.

## Files touched

- `src/components/attendance-hq/ios.tsx` — add `HostLogoBadge`, `HostLogoUploader`
- `src/components/attendance-hq/primitives.tsx` — `AttendanceLogo` becomes a thin wrapper around `HostLogoBadge` (kept for any remaining call sites)
- `src/components/attendance-hq/public-check-in.tsx` — accept and render `hostLogoUrl`
- `src/lib/attendance-hq.functions.ts` — extend `getPublicEventByQr` to include `hostLogoUrl`; add `getPublicHostBrandingByQr` for any standalone needs
- `src/lib/attendance-hq.ts` — add optional `hostLogoUrl` to the public event payload type
- `src/routes/home.tsx` — add editable logo badge to header
- `src/routes/settings.tsx` — add Branding section with `HostLogoUploader`
- `src/routes/events.$eventId.display.tsx` — render host logo in pass header
- `src/routes/check-in.$qrToken.tsx` — thread `hostLogoUrl` into shell + event card

## Safeguards

- No schema changes — `host_profiles.logo_url` and the `host-logos` storage bucket already exist.
- Public routes never receive host PII; only a short-lived signed URL to the logo image.
- All upload validation (image MIME, ≤3 MB, toast feedback) is preserved from the current implementation.
- Falls back gracefully to the default brand mark when no logo is uploaded.

