

## Make Attendance HQ install like a native mobile app

The app already has the iOS-style shell, safe-area paddings, large-title headers, bottom tab bar, and operational screens. What's missing is the **PWA-lite envelope** so that when a host saves it to their iPhone/Android home screen, it launches full-screen, behaves like an installed app, and surfaces a tasteful Install CTA. No service worker, no Capacitor, no offline caching.

### What you'll get

- Save to Home Screen → launches with no browser chrome, edge-to-edge, respecting notch + home indicator.
- Android/Chrome users see a real "Install Attendance HQ" button on the Home screen and Settings.
- iPhone users see a clean "Add to Home Screen" instructional card on Home (one-time, dismissible) since iOS doesn't allow programmatic installs.
- Once installed, all install prompts disappear automatically.

### Files added

**`public/manifest.webmanifest`** — declares the app to the OS:
- `name`: "Attendance HQ", `short_name`: "Attendance"
- `start_url`: `/home`, `scope`: `/`, `display`: `standalone`, `orientation`: `portrait`
- `background_color`: `#0F3FA0` (brand navy), `theme_color`: `#0F3FA0`
- `icons`: `192x192` and `512x512` PNGs (plus `maskable` variant for Android adaptive icons). I'll generate them from the existing brand mark and place them at `public/icons/`.
- `categories`: `["productivity", "business"]`

**`public/icons/icon-192.png`, `icon-512.png`, `icon-maskable-512.png`** — generated from the existing brand color/wordmark so iOS/Android show a real app icon, not a Safari screenshot.

**`src/hooks/use-install-prompt.ts`** — single source of truth for install state:
- Captures `beforeinstallprompt` (Chrome/Edge/Android) and stashes it.
- Exposes `{ canInstall, isInstalled, isIos, promptInstall(), dismissIosHint(), iosHintDismissed }`.
- `isInstalled` checks `matchMedia('(display-mode: standalone)')` + `navigator.standalone` (iOS).
- `isIos` sniffs UA for iPhone/iPad (only used to decide whether to show the iOS "Share → Add to Home Screen" instructions).
- Persists "iOS hint dismissed" + "installed" in `localStorage` so the banner doesn't nag.
- SSR-safe: all `window` access guarded.

**`src/components/attendance-hq/install-cta.tsx`** — two variants:
- `<InstallBanner />` — slim card for the Home screen. Hides when installed. On Android: button triggers native prompt. On iOS: opens a small in-card hint with the Share-icon glyph + "Tap Share, then Add to Home Screen". Dismissible.
- `<InstallButton />` — single tonal button for the Settings screen (same logic, no banner chrome).

### Files modified

**`src/routes/__root.tsx`** — extend `head()`:
- Add `link rel="manifest" href="/manifest.webmanifest"`.
- Add `link rel="apple-touch-icon" href="/icons/icon-192.png"`.
- Add `link rel="apple-touch-icon" sizes="512x512" href="/icons/icon-512.png"`.
- Add `meta name="mobile-web-app-capable" content="yes"` (Android counterpart of the iOS one already present).
- Add `meta name="apple-mobile-web-app-title" content="Attendance"` so the home-screen label matches `short_name`.
- Viewport already has `viewport-fit=cover` ✓
- Theme-color, apple-mobile-web-app-capable, status-bar-style already present ✓

Also add a tiny one-shot effect in `RootComponent` that adds `class="pwa-standalone"` to `<html>` when `display-mode: standalone` matches, so we can hide install CTAs everywhere via CSS (`.pwa-standalone .install-cta { display: none }`).

**`src/styles.css`** — add three small utilities used by the new install components and to lock down standalone mode:
- `.install-cta` marker class (hidden when `.pwa-standalone` is on `<html>`).
- `html, body { overscroll-behavior-y: none; }` so the app doesn't show the browser's rubber-band/refresh gesture in standalone mode.
- `body { -webkit-tap-highlight-color: transparent; }` to kill the gray flash on tap that breaks the native feel.

**`src/routes/home.tsx`** — render `<InstallBanner />` once near the top of the page (above the featured-event card), wrapped so it only shows for non-installed users.

**`src/routes/settings.tsx`** — render `<InstallButton />` in a new "App" section so users who dismissed the home banner can still install later.

**`src/components/attendance-hq/host-shell.tsx`** — two minor app-shell hardening tweaks:
- The existing `pt-safe-1` on `<main>` is correct; no change needed there.
- Bottom tab bar: keep as-is (already safe-area-padded with `pb-[max(0.6rem,env(safe-area-inset-bottom))]`).
- Add `touch-action: manipulation` on the tab links to remove the 300 ms tap delay quirk on older WebKit.

### Tabs: keep existing 5

Spec suggests Home / Events / Check-In / Attendees / Analytics. The existing tabs are **Home / Clubs / Events / Live / Settings**, where:
- "Live" already serves as the live check-in operations screen → maps to Check-In.
- "Clubs" replaces "Attendees" since this app's roster is club-membership-driven, not a flat attendee list.
- There's no Analytics route built; bolting one on is out of scope for this PWA-lite pass.

So tab structure stays exactly as-is. The spec explicitly allows adapting to existing app structure ("If the current information architecture differs, adapt intelligently to the existing app structure").

### What is explicitly NOT changed

- No service worker, no `vite-plugin-pwa`, no offline caching, no push notifications, no Capacitor.
- No redesign of Home / Events / Live / Clubs / Settings screens — the existing iOS-style shell already meets the "premium native feel" criteria (large-title headers, grouped lists, action tiles, glass tab bar, hero washes). Re-skinning is out of scope; the gap is install behavior, not visual polish.
- No new Analytics or Attendees routes (the existing data model uses Clubs + Events; an analytics screen is a separate feature).
- No changes to auth, onboarding, routing, or business logic.
- No changes to `src/integrations/supabase/*`, `wrangler.jsonc`, or env handling.

### After this ships

Republish once. On iPhone Safari → Share → Add to Home Screen → tap the icon → app opens full-screen, no Safari URL bar, status bar overlays cleanly, bottom tab bar floats above the home indicator. On Android Chrome → "Install" banner appears, one tap installs, opens like a native app from the launcher.

