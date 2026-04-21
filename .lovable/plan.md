

## Why your app shows "App isn't configured"

The error screen is doing exactly what it was designed to do: the Supabase client tried to initialize, couldn't find `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` (or the SSR `SUPABASE_*` equivalents), and threw. The root error boundary recognized the message and rendered the "App isn't configured" card.

The console confirms this exact error:
> "Missing Supabase environment variables. Ensure SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY (or VITE_ prefixed versions) are set in your .env file."

## Root cause

The `.env` file is **missing from the project filesystem**. Only `.env.example` exists. Lovable Cloud is supposed to auto-generate `.env` from the connected backend (the values listed in the project metadata) but in your current workspace it hasn't been written, so:

- `import.meta.env.VITE_SUPABASE_URL` is `undefined` in the browser bundle
- `process.env.SUPABASE_URL` is `undefined` during SSR
- Every page crashes at the first `supabase.*` access

This is why every route — landing, sign-in, check-in — shows the same error card. Nothing in your UI work caused this; the connection to Lovable Cloud just isn't being injected.

## Fix (one click — no code changes)

Reconnect / refresh Lovable Cloud so the `.env` is regenerated:

1. Open the project's **Cloud** panel (Connectors → Lovable Cloud).
2. If Cloud is shown as connected, click **Refresh / Sync** (or toggle off and back on). If it shows as disconnected, click **Enable Cloud**.
3. Wait for the project to rebuild — the preview will reload automatically.

After that, `.env` will be written with the four required keys and the app will boot normally.

## If reconnecting doesn't write `.env`

Fallback: I can manually create `.env` in the workspace using the values already on file for this project (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, plus `VITE_SUPABASE_PROJECT_ID`). This unblocks the client + SSR boot. The service-role key (`SUPABASE_SERVICE_ROLE_KEY`) used by `client.server.ts` and any admin server functions cannot be recreated from public metadata and must come from the Cloud sync — so admin-only flows (public check-in lookups that use `supabaseAdmin`) will still need the proper Cloud reconnect to work.

## What I'll do once you confirm

- **Preferred:** you reconnect Cloud, the `.env` regenerates, app comes back up. No code changes needed.
- **If reconnect fails:** I'll write a `.env` with the public anon credentials so the UI boots, then we troubleshoot the missing `SUPABASE_SERVICE_ROLE_KEY` together.

<lov-actions>
  <lov-open-backend>Open Lovable Cloud</lov-open-backend>
</lov-actions>

