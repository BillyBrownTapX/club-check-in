
Fix the real deployment/config mismatch that is still breaking Attendance HQ.

## What is actually wrong now

The earlier diagnosis is outdated.

- The project now does have a local `.env` file in the sandbox.
- But the published app still renders **“App isn't configured”**.
- That means the problem is no longer “missing file in the workspace” — it is that the **deployed app is not receiving the backend env values at build/runtime**.

Most likely cause:
- the manual `.env` workaround only affected the local sandbox session
- `.env` is gitignored and is not a durable deployment source
- the published build still does not have the required browser-safe backend values (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`) injected by Lovable Cloud

The evidence:
- published URL still shows the root config error screen
- preview fetch is gated behind the auth bridge, so it did not prove the deployed app was healthy
- runtime secrets already exist for this project, so this is a **Cloud/deployment injection problem**, not a missing-secret problem

## Plan

### 1. Repair the backend env source of truth
Use Lovable Cloud as the source of configuration again instead of relying on the sandbox-only `.env`.

- Verify the project’s Cloud connection is healthy
- Refresh/reconnect the Cloud integration so the managed environment is regenerated for builds
- Confirm the public backend values are available to the app build, not just to runtime secrets

### 2. Remove the false assumption that the sandbox `.env` fixed deployment
Treat the current `.env` as a temporary local workaround only.

- Do not rely on the manually created `.env` as the permanent fix
- Ensure the project rebuilds from managed configuration so preview/published deployments receive the same values consistently

### 3. Rebuild and republish from the repaired configuration
Once Cloud env injection is restored:

- trigger a fresh preview rebuild
- verify the root route no longer throws the “missing backend settings” error
- republish so the public site is rebuilt from the corrected environment state

### 4. Verify both app entry paths
After the rebuild, explicitly test these routes:

- `/`
- `/sign-in`
- `/sign-up`
- `/forgot-password`
- `/check-in/$qrToken` with a valid token if available

Success criteria:
- landing page renders instead of the root error card
- auth screens load normally
- no “App isn't configured” fallback appears
- public check-in can at least load its shell instead of failing immediately

### 5. Only if Cloud re-sync still fails
If the deployment still cannot see the backend values after reconnect/rebuild, do a second-pass fix focused on configuration delivery:

- inspect how browser-safe backend config is being injected into TanStack/Vite builds
- repair that delivery path at the project/platform config layer
- keep the generated backend client untouched unless absolutely necessary

## Files/code impact

Expected best-case outcome:
- no app code changes required
- this is fixed by restoring proper managed environment injection and republishing

If a second pass is needed, the investigation will center on:
- `vite.config.ts`
- deployment/build environment wiring
- Lovable Cloud configuration state

## Important constraint

Do not continue chasing generic frontend bugs until this is resolved. The app is failing before normal product flows begin, so deployment/backend config must be fixed first.
