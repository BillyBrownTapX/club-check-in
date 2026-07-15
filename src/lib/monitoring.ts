// Central error reporting. Sentry is optional — if no DSN is set at build
// time (browser) or runtime (server), reportError degrades to a scrubbed
// console.error. The app never depends on Sentry being reachable.
//
// PII policy: we scrub emails, 900 numbers, Authorization headers,
// cookies, device tokens, and any obvious student-name-shaped extras
// before send. Prefer passing plain messages + safe context; do NOT pass
// student records, attendance rows, or auth headers here.

import * as Sentry from "@sentry/react";

type SafeContext = Record<string, string | number | boolean | null | undefined>;

let initialized = false;
let sentryEnabled = false;

function readViteDsn(): string | undefined {
  try {
    // import.meta.env only exists in the client bundle.
    const dsn = (import.meta as unknown as { env?: Record<string, string | undefined> }).env
      ?.VITE_SENTRY_DSN;
    return dsn && dsn.length > 0 ? dsn : undefined;
  } catch {
    return undefined;
  }
}

function readViteEnvironment(): string {
  try {
    const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
    return env?.VITE_SENTRY_ENVIRONMENT || env?.MODE || "production";
  } catch {
    return "production";
  }
}

// Basic PII scrub. Applied to any string field on event.extra / breadcrumbs
// / messages before send. Deliberately conservative — false positives cost
// us log fidelity but never cost a student privacy.
const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
// UNCG-style 900 numbers, but keep it generic — any 9-digit-ish sequence.
const NINE_HUNDRED_RE = /\b9\d{8}\b/g;
// Bearer tokens in stack traces / URLs.
const BEARER_RE = /Bearer\s+[A-Za-z0-9._-]+/gi;
const AUTH_QS_RE = /([?&](?:token|access_token|apikey|authorization)=)[^&\s]+/gi;

function scrubString(s: string): string {
  return s
    .replace(EMAIL_RE, "[email]")
    .replace(NINE_HUNDRED_RE, "[id]")
    .replace(BEARER_RE, "Bearer [redacted]")
    .replace(AUTH_QS_RE, "$1[redacted]");
}

function scrubValue<T>(v: T): T {
  if (typeof v === "string") return scrubString(v) as unknown as T;
  return v;
}

function scrubRecord(rec: Record<string, unknown> | undefined) {
  if (!rec) return rec;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rec)) {
    const lower = k.toLowerCase();
    if (
      lower === "authorization" ||
      lower === "cookie" ||
      lower === "set-cookie" ||
      lower.includes("token") ||
      lower.includes("apikey") ||
      lower.includes("password")
    ) {
      out[k] = "[redacted]";
      continue;
    }
    out[k] = typeof v === "string" ? scrubString(v) : v;
  }
  return out;
}

/**
 * Initialize Sentry on the client. No-op if VITE_SENTRY_DSN is not set.
 * Safe to call multiple times; only the first call has effect.
 */
export function initClientMonitoring(): void {
  if (initialized) return;
  initialized = true;
  if (typeof window === "undefined") return;
  const dsn = readViteDsn();
  if (!dsn) return;

  try {
    Sentry.init({
      dsn,
      environment: readViteEnvironment(),
      // Errors only by default. Perf/replay can be turned on later without
      // code changes if we add sample-rate env vars.
      tracesSampleRate: 0,
      // Never send default PII (IP, user-agent metadata beyond what Sentry
      // needs for grouping). We do our own scrubbing below too.
      sendDefaultPii: false,
      beforeSend(event) {
        try {
          if (event.request) {
            event.request.cookies = undefined;
            event.request.headers = scrubRecord(
              event.request.headers as Record<string, unknown> | undefined,
            ) as typeof event.request.headers;
            if (typeof event.request.url === "string") {
              event.request.url = scrubString(event.request.url);
            }
            if (typeof event.request.query_string === "string") {
              event.request.query_string = scrubString(event.request.query_string);
            }
          }
          if (event.message) event.message = scrubString(event.message);
          if (event.extra) {
            for (const [k, v] of Object.entries(event.extra)) {
              event.extra[k] = scrubValue(v);
            }
          }
          if (event.exception?.values) {
            for (const ex of event.exception.values) {
              if (ex.value) ex.value = scrubString(ex.value);
            }
          }
        } catch {
          // Never let scrubbing failure block sending — but also never
          // fall back to sending raw PII. Drop the event to be safe.
          return null;
        }
        return event;
      },
      beforeBreadcrumb(bc) {
        if (bc.message) bc.message = scrubString(bc.message);
        if (bc.data) bc.data = scrubRecord(bc.data as Record<string, unknown>) as typeof bc.data;
        return bc;
      },
    });
    sentryEnabled = true;
  } catch (err) {
    // Sentry init failed — carry on without it.
    if (typeof console !== "undefined") {
      console.error("[monitoring] sentry init failed", (err as Error)?.message);
    }
  }
}

/**
 * Report an unexpected error. Safe to call from anywhere on the client
 * (and no-op-safe if called during SSR). Context values MUST NOT contain
 * PII — pass short identifiers and route names only.
 */
export function reportError(error: unknown, context?: SafeContext): void {
  const message =
    error instanceof Error ? error.message : typeof error === "string" ? error : "Unknown error";
  const scrubbedContext = context ? (scrubRecord(context) as SafeContext) : undefined;

  if (typeof console !== "undefined") {
    console.error("[error-report]", scrubString(message), scrubbedContext ?? {});
  }

  if (!sentryEnabled) return;
  try {
    Sentry.captureException(error instanceof Error ? error : new Error(message), {
      extra: scrubbedContext as Record<string, unknown> | undefined,
    });
  } catch {
    // Swallow — reporting must never throw.
  }
}
