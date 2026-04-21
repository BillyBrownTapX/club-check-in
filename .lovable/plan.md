
Fix the real configuration failure that is keeping Attendance HQ stuck on the “App isn’t configured” screen.

## Confirmed issue

The app is failing before normal UI logic runs.

What is confirmed:
- The published site currently renders the root config fallback, not the app.
- The browser console error is:
  `Missing Supabase environment variables. Ensure SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY (or VITE_ prefixed versions) are set in your .env file.`
- `src/integrations/supabase/client.ts` throws immediately if `VITE_SUPABASE_URL` or `VITE_SUPABASE_PUBLISHABLE_KEY` are missing.
- `wrangler.jsonc` currently documents the required values, but does not actually define any `vars`.
- The project secrets currently do not include the required backend keys.

This is a deployment/config problem, not a visual/UI bug.

## What to implement

### 1. Restore the required backend configuration
Set the missing project configuration so both the browser bundle and server-side code receive the values they expect:

Required public values:
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`

Required server-only value:
- `SUPABASE_SERVICE_ROLE_KEY`

### 2. Make the public values durable in project config
Update `wrangler.jsonc` to include a real `vars` block for the non-secret values above so the deployment has a stable source of truth for:
- browser Vite injection
- SSR/runtime access
- future publishes

Keep `SUPABASE_SERVICE_ROLE_KEY` as a secret only.

### 3. Leave generated client files untouched
Do not edit:
- `src/integrations/supabase/client.ts`
- `src/integrations/supabase/client.server.ts`

They are correctly failing fast; the missing config is the actual issue.

### 4. Republish after config is restored
After the backend values are restored, rebuild/publish the app so the generated browser bundle includes the `VITE_*` values.

## Files/settings involved

### Code/config changes
- `wrangler.jsonc`
  - add a real `vars` section with the public backend values

### Project/backend settings
- Lovable Cloud project secrets/settings
  - ensure `SUPABASE_SERVICE_ROLE_KEY` exists
  - ensure the public backend values are present for deployment

## Verification checklist

After the fix:
- `/` loads the landing page instead of the config error card
- `/sign-in` loads normally
- `/sign-up` loads normally
- `/forgot-password` loads normally
- `/check-in/$qrToken` no longer fails immediately because of missing config
- browser console no longer shows the missing-environment error
- published site and preview behave consistently

## Out of scope

- no redesign work
- no auth-flow refactor
- no database schema changes
- no route logic changes unless a second issue appears after config is restored

## Expected outcome

Attendance HQ will boot again because the deployment will finally receive the backend settings that the app already expects.
