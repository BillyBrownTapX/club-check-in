// Centralized error normalization. Two audiences:
//
//   • SERVER (attendance-hq.functions.ts) — every Supabase / Postgres error
//     should funnel through `safeMessage(error, fallback)` so we never throw
//     `error.message` verbatim back to the browser. Raw messages can include
//     internal table names, JWT details, constraint identifiers, or row
//     contents we don't want a host (let alone a public student) to see.
//     We log the raw error server-side so the cause is still debuggable.
//
//   • BROWSER (sign-in / sign-up / reset-password) — those routes hit
//     supabase.auth.* directly without going through our server-fn
//     middleware, so the error object lands in the React tree raw. Pass it
//     through `normalizeSupabaseAuthError(...)` to map known auth failure
//     modes to friendly product copy and drop everything else to a generic
//     fallback.
//
// IMPORTANT: keep this module isomorphic (no node-only imports). It's
// imported by both server fn handlers and browser routes.

type RawError =
  | { message?: string; code?: string; details?: string; status?: number }
  | null
  | undefined;

const GENERIC_WRITE_MESSAGE = "Something went wrong saving your changes. Please try again.";
const GENERIC_READ_MESSAGE = "Something went wrong loading this page. Please try again.";

// Postgres error codes we translate to product copy. Codes not listed here
// fall back to the caller-supplied `fallback` so the UX message still
// matches the action the host was taking ("Unable to create club" vs
// "Unable to load events"). The raw .message is never returned.
//
//   23505 = unique_violation        — duplicate row
//   23503 = foreign_key_violation   — referenced row missing
//   23514 = check_violation         — DB-level invariant
//   42501 = insufficient_privilege  — RLS denied
//   PGRST301/302                    — PostgREST RLS / row-not-visible
function publicMessageForCode(code: string | undefined, fallback: string): string {
  switch (code) {
    case "23505":
      return "That looks like a duplicate. Try refreshing.";
    case "23503":
      return "A linked record is missing. Please refresh and try again.";
    case "23514":
      return "That value isn't allowed. Please double-check your inputs.";
    case "42501":
    case "PGRST301":
    case "PGRST302":
      return "You don't have access to that.";
    default:
      return fallback;
  }
}

// Returns a sanitized message string for a Supabase / Postgres error. Always
// safe to pass to `new Error(...)`. Always logs the raw payload server-side
// so we can investigate the actual cause without exposing it to the user.
//
// Use the `mode` hint to pick a sane fallback when the caller doesn't
// specify one — reads default to "couldn't load", writes to "couldn't save".
export function safeMessage(error: RawError, fallback?: string, mode: "read" | "write" = "write"): string {
  const defaultFallback = mode === "read" ? GENERIC_READ_MESSAGE : GENERIC_WRITE_MESSAGE;
  const finalFallback = fallback ?? defaultFallback;
  if (!error) return finalFallback;
  // Log the raw error so server logs retain the real cause. We deliberately
  // use console.error so it shows up in standard CF / node logs without
  // requiring a logger dependency.
  if (typeof console !== "undefined") {
    console.error("[server-error]", {
      code: (error as { code?: string }).code,
      message: error.message,
      details: (error as { details?: string }).details,
    });
  }
  return publicMessageForCode((error as { code?: string }).code, finalFallback);
}

// Map a Supabase auth error into UI copy. The browser-side auth flows
// (sign-in, sign-up, forgot-password, reset-password) call Supabase
// directly, so this is the only chokepoint that prevents raw
// "AuthApiError: invalid_grant" style messages from surfacing.
//
// Keep matchers narrow — when in doubt return the fallback so we never
// surprise a user with a Supabase internal string.
export function normalizeSupabaseAuthError(
  error: { message?: string; status?: number } | null | undefined,
  fallback = "Something went wrong. Please try again.",
): string {
  if (!error) return fallback;
  const raw = (error.message ?? "").toLowerCase();
  if (!raw) return fallback;

  if (raw.includes("invalid login") || raw.includes("invalid_credentials") || raw.includes("invalid grant")) {
    return "That email or password isn't right.";
  }
  if (raw.includes("email not confirmed") || raw.includes("not_confirmed")) {
    return "Please confirm your email address before signing in.";
  }
  if (raw.includes("already registered") || raw.includes("user already") || raw.includes("duplicate") && raw.includes("user")) {
    return "An account with that email already exists. Try signing in.";
  }
  if (raw.includes("password") && (raw.includes("at least") || raw.includes("characters") || raw.includes("weak"))) {
    return "Password must be at least 8 characters.";
  }
  if (raw.includes("rate limit") || raw.includes("too many requests") || error.status === 429) {
    return "Too many attempts. Please wait a moment and try again.";
  }
  if (raw.includes("token") && (raw.includes("expired") || raw.includes("invalid"))) {
    return "This reset link is no longer valid. Request a new one.";
  }
  if (raw.includes("auth session missing") || raw.includes("session_not_found")) {
    return "Open this page from your reset email to choose a new password.";
  }
  if (raw.includes("network") || raw.includes("failed to fetch") || raw.includes("load failed")) {
    return "Network problem. Check your connection and try again.";
  }

  // Don't echo raw Supabase strings. We log to console so a developer
  // looking at devtools can still see what happened.
  if (typeof console !== "undefined") {
    console.warn("[auth-error] unhandled supabase auth error", { message: error.message, status: error.status });
  }
  return fallback;
}
