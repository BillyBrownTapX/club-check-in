# Verify email domain, then send a real agent invitation email

## 1. DNS records — already done

`setup.attendance-hq.com` is already verified: the NS delegation to Lovable's nameservers is live and Lovable manages SPF/DKIM/MX inside that delegated zone. No NS or TXT records need to be added, and no manual DNS records should be created — adding extra records on that subdomain would conflict with the delegation.

So there is nothing to do for step one; the work is only sending and confirming a real email.

## 2. Send a real agent invitation email

The send path already exists: the `/agents` page's "Email me this link" action calls a server-verified send that uses the signed-in host's own account email as the recipient, with a per-host daily idempotency key.

Steps:

1. Publish the app so the current email server routes and send helper are deployed. Managed sends run in the deployed app, so a published build is the reliable path for a real delivery.
2. Trigger one real send to the owner's own host account address (Billy Brown's account email) — either by clicking "Email me this link" on `/agents` while signed in, or by invoking the send server function directly with the signed-in session.
3. Confirm the outcome in the email delivery logs: a `sent` event for the `agent-setup-link` label to that recipient. If the event is `suppressed`, report the suppression source and stop rather than retrying. If it is `rejected`, report the provider's refusal reason.
4. Report back the recipient address, the subject line, and the setup link the email points to.

## Notes

- The email links to the `/agents` setup page on the canonical production URL, not directly to a consent screen — a consent URL is only valid during a live connect attempt from an assistant.
- Because the idempotency key is per host per day, repeat clicks on the same day will not produce a second email. If a second real send is needed today, it goes to a different recipient or waits until tomorrow.

## Technical details

- No code changes are expected. Files involved: `src/lib/agent-integration.functions.ts` (send call site), `src/lib/email-templates/agent-setup-link.tsx` (template), `src/lib/email-templates/send-email.ts` (helper, sender domain `setup.attendance-hq.com`).
- Verification uses the email log listing filtered to the recipient and the `agent-setup-link` label.
