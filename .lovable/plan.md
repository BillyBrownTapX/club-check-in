# Branded Attendance HQ auth emails

Your sending domain `setup.attendance-hq.com` is verified, and the project has no custom auth email templates yet — Lovable's generic defaults are going out today. This adds Attendance HQ branded templates for every authentication email.

## What the user gets

All six authentication emails come from Attendance HQ and look like the app:

- Confirm your signup
- Reset your password
- Magic sign-in link
- Host invitation
- Email address change confirmation
- Reauthentication code

Each email uses the navy/electric-blue brand identity already in the app: a white email background, a deep-navy header band with the Attendance HQ wordmark, an electric-blue rounded action button, plain-English body copy in the app's voice ("campus event check-in in seconds"), a fallback plain-text link under every button in case the button doesn't render, a short expiry note, and a quiet footer with the app name and a link back to attendance-hq.com. Gold is used only as a thin accent.

Copy tone matches the product: hosts confirming an account see language about getting their first event live; password reset makes the "if you didn't request this, ignore it" line prominent.

## Technical approach

1. Scaffold the managed auth email templates for the project (creates the six React Email templates plus the compatible auth webhook route). No queues, tables, or hand-written signature verification.
2. Restyle each scaffolded template with the app's brand values pulled from `src/styles.css`, converted to hex for email-client safety:
   - navy `#0B1F44` header band and headings
   - electric blue primary button and links
   - gold `#E0A32A`-family thin accent rule
   - white `#ffffff` body background (required for email clients), light `#F4F6FB` inner card
   - Plus Jakarta Sans with Arial/Helvetica fallbacks
3. Set per-type subject lines in the webhook route's `emails` map (e.g. "Confirm your Attendance HQ account", "Reset your Attendance HQ password"), keeping all six action types present.
4. Verify with a typecheck that templates and route compile.

Notes: emails send from your verified subdomain automatically — no keys or provider setup. Because the branded flow depends on the published site, the new look lands on the live site once published; delivery status is visible in Cloud → Emails.

## Out of scope

No changes to sign-in/sign-up screens, auth logic, redirect URLs, or app (transactional) emails such as event notifications — those can be a separate follow-up.
