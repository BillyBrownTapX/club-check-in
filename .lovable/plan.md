# Branded agent consent + emailed setup link

Two pieces of work: make the AI-assistant approval screen feel like Attendance HQ, and let a host email themselves a branded setup link from `setup.attendance-hq.com` so they can finish connecting their assistant on any device.

## 1. Branded consent screen

The approval screen an assistant sends the host to (`/.lovable/oauth/consent`) currently renders a plain card. Rebuild it with the product's identity:

- Navy header band with the Attendance HQ wordmark and the "Campus event check-in in seconds" tagline, gold accent rule, matching the branded emails.
- Clear request summary: the connecting client's name, and an explicit permission list — read your organizations, read events, read attendance rosters and head counts, create events as you.
- Reassurance line: the assistant acts only as this host, sees only what they already can, and access can be revoked anytime.
- Approve (brand gradient) / Deny buttons, busy state, inline error banner, safe-area padding so it looks right on a phone.
- Same branded shell reused for the "authorization unavailable" error state.

No change to the approve/deny logic, session gate, or redirect handling — visual/presentation only.

## 2. Agents setup page

New host route `/agents` explaining how to connect ChatGPT, Claude, Cursor, or Lovable:

- The MCP server URL for this app, copy-to-clipboard.
- Short step list per client, plus what the assistant can do (the four tools).
- Note that signing in and approving happens on the branded consent screen.
- Own SEO/head metadata; reachable from the host nav.

## 3. Email me the setup link

- Scaffold the app-email system (template registry + server-only send helper) so the app can send branded email from `setup.attendance-hq.com`.
- New template `agent-setup-link`, built on the existing shared email brand shell (navy header, gold rule, electric-blue button), subject like "Connect your AI assistant to Attendance HQ". Button links to the `/agents` setup page on the canonical production URL; body lists the assistant capabilities and a paste-this-link fallback.
- On the club detail page, next to Officers, add a "Connect an AI assistant" row with an "Email me the setup link" action. It sends to the signed-in host's own account email — the address is never taken from the form — and shows a success or failure toast.
- Send happens in a server route/function that verifies the signed-in host, uses their account email as the recipient, and derives an idempotency key so repeat clicks don't duplicate mail. A suppressed recipient is reported back as a plain "we couldn't email that address" message rather than an error.

## Notes

- Direct-to-consent links can't be emailed: a consent URL is only valid for a live connect attempt from an assistant, so the email points at the setup page instead.
- The email domain `setup.attendance-hq.com` is verified; sending activates once the app is published with the new email routes.

## Technical details

- `src/routes/[.]lovable.oauth.consent.tsx`: presentation rebuild only.
- New `src/routes/agents.tsx`; nav entry alongside existing host links.
- `email_domain--scaffold_transactional_email_templates` creates `src/lib/email-templates/registry.ts` and `send-email.ts`; new `src/lib/email-templates/agent-setup-link.tsx` imports the existing `EmailShell`/`ActionButton` from `brand.tsx` and registers in the registry.
- Send call site: new server function in the existing attendance-hq server-function module guarded by the project's auth middleware, calling `sendTemplateEmail('agent-setup-link', <host account email>, ...)`.
- Verification: typecheck, render the new template locally, and screenshot the consent screen and `/agents` at phone and desktop widths.
