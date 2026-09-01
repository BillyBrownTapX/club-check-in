# Why the owner account landed on the host app

## What happened

Your auth log shows this exact sequence inside one browser session:

- 03:32:49 — signed in as the host account (`billybrown@tapx.us`)
- 03:33:47 — signed out
- 03:34:00 — signed in as `billy.brown@ingresssoftware.com`

The owner check is cached in the app's client-side query cache under a fixed key
(`["owner-admin", "me"]`) with a 5-minute freshness window, and that cache is
never cleared when the signed-in user changes. So when you signed in as the
owner, the app re-used the previous account's cached answer ("not an owner"),
skipped the redirect to `/owner-admin`, and rendered the host workspace at
`/home`.

Nothing was actually exposed: the owner console data is still server-verified,
and the host screens you saw were reading the owner account's own (empty) host
data. It's a stale-cache routing bug, not a permission breach. A hard refresh
would have corrected it.

## The fix

1. Scope the owner probe cache to the signed-in user, so a different account can
   never read another account's answer:
   `["owner-admin", "me", userId]`.
2. Clear the whole query cache on any auth identity change (sign-in as a
   different user, sign-out) in the auth provider's `onAuthStateChange` handler,
   so no cached data survives an account switch anywhere in the app.
3. Treat "we don't know yet" as blocking on host screens: while the owner probe
   is resolving after an identity change, the host gate should hold rendering
   instead of showing the host workspace.

## Technical details

- `src/hooks/use-owner-admin-status.ts` — include the Supabase user id in
  `OWNER_ADMIN_ME_KEY` usage; keep the server function as the sole authority.
- `src/components/attendance-hq/auth-provider.tsx` — in `onAuthStateChange`,
  compare the previous user id to the next one; when it changes (including to
  null), call `queryClient.clear()`.
- `src/components/attendance-hq/host-management.tsx` — `useRequireHostRedirect`
  already returns `loading` while `owner.checking`; with a user-scoped key the
  post-switch state correctly reports "checking" instead of a stale `false`.

No database, RLS, or server-function changes are needed — the server-side owner
verification already behaved correctly.
