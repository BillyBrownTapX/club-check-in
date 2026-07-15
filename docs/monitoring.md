# Monitoring & health checks

Attendance HQ exposes three unauthenticated health endpoints and integrates
optionally with Sentry for error reporting. All URLs below are on the
production origin: `https://checkin-swiftly.lovable.app`.

## Health endpoints

| Path                     | Purpose                                            | Failure code |
| ------------------------ | -------------------------------------------------- | ------------ |
| `/api/health`            | Liveness. Worker is answering. No DB call.         | never 5xx    |
| `/api/health/ready`      | Readiness. Data API (Supabase) reachable.          | 503          |
| `/api/health/check-in`   | Public check-in path can talk to the admin client. | 503          |

All three return JSON with `Cache-Control: no-store` and never leak PII,
keys, or connection strings. `reason` on failures is deliberately generic
(`config`, `database`, `admin_client`).

### Suggested external monitors

Point an external uptime provider (Better Stack, UptimeRobot, Cloudflare
Health Checks, Pingdom) at each URL. Recommended cadence:

- `/api/health` — every 1 minute (cheap; catches Worker outages).
- `/api/health/ready` — every 5 minutes (validates the DB).
- `/api/health/check-in` — every 5 minutes (validates the service-role
  admin path, which the public check-in flow depends on).
- Optionally `GET /` expecting `200` to catch SSR regressions.

Any non-200 on `/ready` or `/check-in` means the app is degraded even if
`/api/health` still returns 200 — configure your monitor to alert.

### What "degraded" means

- `reason: "config"` — the Worker booted without `SUPABASE_URL` /
  `SUPABASE_PUBLISHABLE_KEY`. Wrangler config regression.
- `reason: "database"` — the Data API refused or timed out. Could be a
  Supabase incident, network partition, or RLS misconfiguration on
  `universities` / `events`.
- `reason: "admin_client"` — `SUPABASE_SERVICE_ROLE_KEY` is missing or
  invalid. Public check-in will fail until this is fixed.

## Sentry (optional)

Sentry is **opt-in**. Without a DSN, the app runs exactly as before and no
network calls are made to Sentry.

### To enable

1. Create a Sentry project (React platform).
2. Set the browser DSN (public, inlined into the client bundle):
   - `VITE_SENTRY_DSN` in the deployment env
   - Optionally `VITE_SENTRY_ENVIRONMENT` (defaults to `production`)
3. Set the server DSN as a Worker secret:
   ```
   wrangler secret put SENTRY_DSN
   ```
4. In Sentry, enable an alert rule for **new issues** and **error rate
   spikes** so campus staff get paged on 5xx bursts.

**Until you complete steps 2 and 3, alerts do NOT fire — the app is
running without Sentry.** The health endpoints above still work; they are
independent of Sentry.

### What gets captured

- Errors thrown in the root error boundary (`src/routes/__root.tsx`).
- Errors thrown in the route-level default boundary (`src/router.tsx`).
- Anything passed to `reportError(error, context?)` from
  `src/lib/monitoring.ts`.

### PII scrubbing

`src/lib/monitoring.ts` scrubs before send:

- Emails → `[email]`
- 900 numbers → `[id]`
- `Bearer …` tokens in messages/URLs → `Bearer [redacted]`
- Query-string `token`, `access_token`, `apikey`, `authorization` → `[redacted]`
- Any breadcrumb / request-header field named `authorization`, `cookie`,
  `set-cookie`, or containing `token` / `apikey` / `password`.

Do **not** pass student rows, attendance records, or auth headers into
`reportError`. Pass short identifiers only (`{ boundary: "route" }`,
`{ eventId }`, etc.).
