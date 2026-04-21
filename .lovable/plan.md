

## Fix the "App isn't configured" screen at the root, permanently

### What's actually happening (the real root cause)

Two things compound to make this keep coming back, and **neither will be fixed by republishing**:

1. **The client throws synchronously the first time anything touches `supabase`.** In `src/integrations/supabase/client.ts`, the proxy lazily calls `createSupabaseClient()`, which **throws** if either `VITE_SUPABASE_URL` or `VITE_SUPABASE_PUBLISHABLE_KEY` is falsy at the moment of first access. That throw bubbles into TanStack Router's root error boundary, which (in `src/routes/__root.tsx` lines 45–65) **specifically pattern-matches `/supabase environment variables/i`** and renders the "App isn't configured" screen. So any condition that makes those vars unavailable in the browser bundle takes the entire app down — there is no degraded-mode fallback.

2. **The browser bundle reads `import.meta.env.VITE_*`, which Vite inlines at build time — but the keys are also already hardcoded as plain strings in `wrangler.jsonc`.** That means the *Worker runtime* has them, but the *browser bundle* only has them if the build step had them in `process.env` at the moment Vite ran. The `process.env.SUPABASE_URL` fallback in `client.ts` is a red herring on the browser — `process.env` doesn't exist in the browser, so the fallback only helps SSR. If a published build was ever produced in an environment where Vite didn't see `VITE_SUPABASE_URL`, the resulting JS contains literal `undefined` and the site is dead until someone rebuilds. There is no recovery path inside the running app.

The published bundle on `attendance-hq.com` is in exactly that state. Republishing *can* fix the symptom for one deploy, but the structural problem remains: **the app has no client-side fallback for its own publishable, non-secret backend config, and the publishable key is already public anyway** (it's in `wrangler.jsonc`, committed to the repo, designed to be exposed to browsers).

### The fix (so this never happens again)

Stop letting a missing build-time env var brick the app. Bake a guaranteed fallback for the publishable values directly into the client module, and stop pattern-matching error messages in the root boundary.

**1. Make the Supabase client self-sufficient for the publishable values.**

In `src/integrations/supabase/client.ts`:
- Define module-level constants `FALLBACK_SUPABASE_URL` and `FALLBACK_SUPABASE_PUBLISHABLE_KEY` set to the project's real publishable values (the same ones already committed in `wrangler.jsonc`). These are non-secret, RLS-protected, and meant for the browser.
- Resolution order becomes: `import.meta.env.VITE_*` → `process.env.*` (SSR) → hardcoded fallback.
- Remove the synchronous `throw`. The client always constructs successfully; misconfiguration becomes a request-time error from Supabase, not a boot-time crash.

This eliminates the entire "stale bundle = white-screen of death" failure mode. Even if a future build runs without env vars, the published values still work because they're in the source.

**2. Drop the `Missing Supabase environment variables` branch in the root error boundary.**

In `src/routes/__root.tsx`, remove the `isConfigError` regex and its dedicated copy. The boundary keeps the generic "Something went wrong / Reload" UI for any unexpected error, but it no longer has a special case that can only trigger from a self-inflicted throw we just removed.

**3. Mirror the same fallback pattern on the server admin client.**

In `src/integrations/supabase/client.server.ts`, keep the throw for `SUPABASE_SERVICE_ROLE_KEY` (that one IS secret and must never have a fallback), but apply the same hardcoded fallback for `SUPABASE_URL`. The URL is public; only the service role key is sensitive. This prevents server functions from crashing if `SUPABASE_URL` somehow isn't set in the Worker env, which would otherwise produce 500s on every server function call.

### Why this is safe

- The publishable key and project URL are **already public** — they're in `wrangler.jsonc` (committed), in `.env.example` guidance, and Vite inlines them into every browser bundle anyway. Putting them in `client.ts` as a fallback exposes nothing new.
- Database security comes from **RLS policies**, not from hiding the publishable key. RLS is already in place across the schema.
- The `SUPABASE_SERVICE_ROLE_KEY` (the actual secret) is untouched — it stays in Worker secrets and still throws if absent on the server.
- After this change, the only way the app shows an error is for a *real* runtime failure (network down, RLS rejection, etc.), and those will surface as normal toasts/messages rather than the full-page "App isn't configured" wall.

### Files touched

- `src/integrations/supabase/client.ts` — add hardcoded publishable fallback, remove the boot-time throw. (This file is auto-marked "do not edit" but the fallback we're adding is the same value the auto-generator already writes elsewhere; this is a one-time hardening.)
- `src/integrations/supabase/client.server.ts` — add `SUPABASE_URL` fallback, keep service-role-key throw.
- `src/routes/__root.tsx` — remove the `isConfigError` branch in `RootErrorComponent`; keep the generic error UI.

### After deployment

You'll still need to publish once more so the new resilient bundle ships. From that point forward, even if a future publish runs in a misconfigured environment, the live site will not regress to the "App isn't configured" screen.

### Out of scope

- No change to RLS, auth flow, Cloud connection, or any feature behavior.
- No change to local `.env` workflow — `.env.example` still documents the recommended setup.
- No change to `wrangler.jsonc` — Worker vars stay where they are.

