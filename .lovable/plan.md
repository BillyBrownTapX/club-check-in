

## Why the live site shows "App isn't configured"

### What's happening

The `client.ts` Supabase client throws `Missing Supabase environment variables` whenever `VITE_SUPABASE_URL` or `VITE_SUPABASE_PUBLISHABLE_KEY` aren't available at runtime. Your root error boundary (`src/routes/__root.tsx` lines 47–57) specifically matches that error message and renders the "App isn't configured" screen.

So the screen only shows in one situation: **the published JavaScript bundle was built at a moment when those two env vars weren't set.** Vite inlines `import.meta.env.VITE_*` values *at build time* — they get baked into the JS file that ships to the browser. If the values weren't present when that build ran, the bundle contains literally `undefined`, and no amount of fixing env vars later will change the already-published file.

Your current state:
- Preview works → the current in-sandbox build has the env vars and the Supabase integration is healthy.
- `wrangler.jsonc` already declares both `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` for production.
- Worker logs show `attendance-hq.com` returning HTTP 200 with the error UI — so the site is reachable; it's just the stale bundle rendering the config-error fallback.

This matches the classic Lovable pattern: the project was published once while the managed `.env` was missing or stale, and nothing has republished since. The custom domain (`attendance-hq.com`) and the Lovable-hosted URL (`checkin-swiftly.lovable.app`) both serve the same stale bundle.

### The fix: republish

No code change is needed. The `wrangler.jsonc` config and the Supabase client are already correct. You just need to re-run the publish step so a fresh bundle is built with the env vars already in place.

**Steps for you:**
1. Open the **Publish** dialog (top-right in the editor).
2. Click **Update** to rebuild and redeploy. This will take ~30–60 seconds.
3. Hard-refresh `attendance-hq.com` (Cmd/Ctrl + Shift + R) so the browser drops the cached broken bundle.

After the republish, the home page should load normally instead of the "Attention / App isn't configured" screen.

### If it still fails after republishing

That would mean the build itself didn't pick up the env vars, which is rare but fixable. In that case the right next steps are:
- Open **Connectors → Lovable Cloud** and confirm the backend is active/healthy.
- If it looks disconnected or paused, refresh/reconnect the integration, wait for it to be healthy, then publish again.
- As a last resort, open **History** and restore to a known-working version, then republish.

### Out of scope

- No edits to `client.ts`, `wrangler.jsonc`, or `__root.tsx` — the error UI is correct and should stay as a defensive fallback.
- No change to the error-boundary behavior. The "App isn't configured" screen is doing its job: it's telling you the bundle shipped without backend config.

<lov-actions>
<lov-link url="https://docs.lovable.dev/tips-tricks/troubleshooting">Troubleshooting docs</lov-link>
</lov-actions>

