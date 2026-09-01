# Switch canonical origin to attendance-hq.com

## Why the agent link uses the Lovable domain

`PRODUCTION_APP_ORIGIN` in `src/lib/attendance-hq.ts` is hard-coded to `https://checkin-swiftly.lovable.app`. Both the `/agents` page and the `emailAgentSetupLink` server function build their URLs from that constant, so the outgoing email button and the copyable MCP address point to the old Lovable subdomain.

## What to change

1. Update `src/lib/attendance-hq.ts`
   - Change `PRODUCTION_APP_ORIGIN` from `https://checkin-swiftly.lovable.app` to `https://attendance-hq.com`.
   - Keep the existing `looksLikePreviewOrLocal` behavior; any `.lovable.app` host will continue to be treated as preview because it no longer matches the new production origin.

2. Update `src/lib/email-templates/agent-setup-link.tsx`
   - Change the fallback `DEFAULT_SETUP_URL` from `https://checkin-swiftly.lovable.app/agents` to `https://attendance-hq.com/agents`.

3. Update `src/routes/__root.tsx`
   - Change the JSON-LD `sameAs` value from `https://checkin-swiftly.lovable.app` to `https://attendance-hq.com`.

4. Update `src/routes/lovable/email/auth/preview.ts`
   - Change `SAMPLE_PROJECT_URL` from `https://checkin-swiftly.lovable.app` to `https://attendance-hq.com` so the email preview renders the real brand URL.

## Out of scope

- No changes to MCP OAuth issuer configuration or Supabase Auth redirect allowlist.
- No changes to email domain configuration (`setup.attendance-hq.com` remains the sending domain; the app origin remains `attendance-hq.com`).

## Verification

- Build the project and confirm no type errors.
- Trigger the agent setup email from `/agents` and confirm the button link is `https://attendance-hq.com/agents`.
- Confirm the copyable MCP address on `/agents` is `https://attendance-hq.com/mcp`.
