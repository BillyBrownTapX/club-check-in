// Server-only rate-limit helper for public check-in endpoints.
//
// Two buckets run per request, both backed by the SECURITY DEFINER
// `public.check_rate_limit` DB function so hit-and-check is atomic:
//
//   1. Primary (per-IP):  sha256("<scope>:<qrToken>:<clientIp>")
//   2. Global (per-QR):   sha256("g:<scope>:<qrToken>")
//
// Why two buckets: campus / venue Wi-Fi commonly NATs an entire room of
// phones behind one egress IP. A meeting of ~100 students all scanning in
// the first minute legitimately shares one clientIp, so a tight per-IP
// budget locks the room out. We raise per-IP budgets high enough to
// support tens of concurrent students on one NAT (with retries), and add
// a coarser per-(scope, qrToken) global cap so a single QR still can't
// be hammered from unlimited IPs.
//
// Both checks run every call; whichever trips first throws the same
// RateLimitedError. On DB / RPC errors we fail OPEN (log + continue) so a
// counter outage never blocks live check-in.

import { createHash } from "crypto";
import { getRequestHeader } from "@tanstack/react-start/server";

export type RateLimitConfig = {
  maxHits: number;
  windowSeconds: number;
};

// Per-endpoint budgets sized for a shared-NAT event burst. A whole meeting
// (~100 phones) hitting one endpoint through one campus egress IP within
// 60s must succeed with retries; only single-client spam should trip.
export const CHECK_IN_RATE_LIMITS = {
  lookup: { maxHits: 100, windowSeconds: 60 },
  register: { maxHits: 80, windowSeconds: 60 },
  fast: { maxHits: 100, windowSeconds: 60 },
} as const satisfies Record<string, RateLimitConfig>;

// Coarser cap keyed on (scope, qrToken) with no IP, so raising the per-IP
// budget above doesn't let an attacker fan out across many IPs to hammer
// one QR. Sized above a realistic single-event burst.
export const CHECK_IN_GLOBAL_RATE_LIMITS = {
  lookup: { maxHits: 600, windowSeconds: 60 },
  register: { maxHits: 400, windowSeconds: 60 },
  fast: { maxHits: 600, windowSeconds: 60 },
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

function primaryBucketKey(scope: string, qrToken: string): string {
  const ip = readClientIp();
  return createHash("sha256").update(`${scope}:${qrToken}:${ip}`).digest("hex").slice(0, 32);
}

function globalBucketKey(scope: string, qrToken: string): string {
  // "g:" prefix keeps the DB bucket_key namespace distinct from the
  // per-IP bucket without needing a schema change.
  return createHash("sha256").update(`g:${scope}:${qrToken}`).digest("hex").slice(0, 32);
}

export class RateLimitedError extends Error {
  code = "rate_limited" as const;
  constructor() {
    super("Too many attempts. Please wait a moment and try again.");
  }
}

async function runCheck(key: string, config: RateLimitConfig): Promise<boolean> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("check_rate_limit", {
    _bucket_key: key,
    _max_hits: config.maxHits,
    _window_seconds: config.windowSeconds,
  });

  // Fail-open on DB errors — we prefer available check-in over a hard
  // block if the counter table is unreachable. Log for observability.
  if (error) {
    if (typeof console !== "undefined") {
      console.error("[rate-limit] check failed", error.message);
    }
    return true;
  }

  return data !== false;
}

// Throws RateLimitedError when the caller exceeds either the per-IP or
// per-QR global budget. Both buckets are always hit so the two counters
// stay in sync with real traffic.
// scope: short label identifying the endpoint (e.g. "lookup", "register").
export async function assertRateLimit(
  scope: keyof typeof CHECK_IN_RATE_LIMITS,
  qrToken: string,
): Promise<void> {
  const primaryConfig = CHECK_IN_RATE_LIMITS[scope];
  const globalConfig = CHECK_IN_GLOBAL_RATE_LIMITS[scope];

  const [primaryOk, globalOk] = await Promise.all([
    runCheck(primaryBucketKey(scope, qrToken), primaryConfig),
    runCheck(globalBucketKey(scope, qrToken), globalConfig),
  ]);

  if (!primaryOk || !globalOk) throw new RateLimitedError();
}
