// Server-only rate-limit helper for public check-in endpoints.
//
// Bucket = sha256(qrToken || ":" || clientIp) truncated to 32 hex chars.
// Uses the SECURITY DEFINER `public.check_rate_limit` DB function so the
// hit-and-check is atomic (no read-then-write races when a scanner burst
// fires 50 requests in the same 200ms).

import { createHash } from "crypto";
import { getRequestHeader } from "@tanstack/react-start/server";

export type RateLimitConfig = {
  maxHits: number;
  windowSeconds: number;
};

// Per-endpoint budgets tuned for a large event where ~200 students scan
// their QRs in a 60s burst. A single (token, ip) pair rarely hits > 5
// legitimate calls in a minute; 12 gives headroom for retries.
export const CHECK_IN_RATE_LIMITS = {
  lookup: { maxHits: 12, windowSeconds: 60 },
  register: { maxHits: 6, windowSeconds: 60 },
  fast: { maxHits: 12, windowSeconds: 60 },
} as const satisfies Record<string, RateLimitConfig>;

// Cloudflare / most CDNs place the real client IP in cf-connecting-ip or
// x-forwarded-for. Fall back to "unknown" so the bucket at least degrades
// to per-QR global throttling rather than opening the door.
function readClientIp(): string {
  const cf = getRequestHeader("cf-connecting-ip");
  if (cf) return cf.trim();
  const xff = getRequestHeader("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  const real = getRequestHeader("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}

function bucketKey(scope: string, qrToken: string): string {
  const ip = readClientIp();
  return createHash("sha256").update(`${scope}:${qrToken}:${ip}`).digest("hex").slice(0, 32);
}

export class RateLimitedError extends Error {
  code = "rate_limited" as const;
  constructor() {
    super("Too many attempts. Please wait a moment and try again.");
  }
}

// Throws RateLimitedError when the caller exceeds their per-window budget.
// scope: short label identifying the endpoint (e.g. "checkIn", "lookup").
export async function assertRateLimit(
  scope: keyof typeof CHECK_IN_RATE_LIMITS,
  qrToken: string,
): Promise<void> {
  const config = CHECK_IN_RATE_LIMITS[scope];
  const key = bucketKey(scope, qrToken);

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("check_rate_limit", {
    _bucket_key: key,
    _max_hits: config.maxHits,
    _window_seconds: config.windowSeconds,
  });

  // Fail-open on DB errors — we prefer available check-in over a hard block
  // if the counter table is unreachable. Log for observability.
  if (error) {
    if (typeof console !== "undefined") {
      console.error("[rate-limit] check failed", error.message);
    }
    return;
  }

  if (data === false) throw new RateLimitedError();
}
