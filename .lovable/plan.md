# Fix: Members tile says "No member emails yet"

## What's actually happening (confirmed)

I reproduced it in the preview signed in as a host with real check-ins. Clicking the Members tile fires the member-email request and the server rejects it with **401 Unauthorized** — the request goes out without the host's session token.

Why: every other authorized call on Home goes through the app's `useAuthorizedServerFn` wrapper, which attaches the `Authorization: Bearer <token>` header (there is no global bearer middleware in this project). The Members tile calls the server function directly, so no token is attached and the server's auth middleware rejects it.

Second, smaller bug that hides the real cause: the rejected call resolves to a non-array value instead of throwing, so the code's `if (!emails.length)` branch runs and shows the friendly "No member emails yet" message instead of an auth error. That's why it looks like empty data rather than a failure.

## The fix

1. **Send the token.** In `src/routes/home.tsx`, invoke the member-email function through `useAuthorizedServerFn` (same wrapper the metrics/events/clubs queries use). This also plugs the tile into the centralized 401 handling: an expired session signs the host out and redirects to sign-in instead of silently failing.
2. **Make the empty case honest.** Validate the response is an array before reading `.length`. Anything else is treated as a failure with an error toast, so a transport/auth problem can never masquerade as "no members".
3. **Keep the existing behaviors:** genuine empty roster → info toast; oversized list → clipboard fallback; otherwise open the `mailto:` BCC draft. CSV export stays on "View roster".

## Verification

- Re-run the same preview reproduction: signed-in host clicks Members → request returns 200 and a mail draft opens with the BCC list populated.
- Confirm a host with zero check-ins still gets the friendly "no members yet" message.
- TypeScript check passes.

## Technical notes

- Only `src/routes/home.tsx` changes: swap the direct `getHostMemberEmails()` call for `useAuthorizedServerFn(getHostMemberEmails)` and add an `Array.isArray` guard. No server function, schema, or RLS changes — the server side already works when the token is present.
