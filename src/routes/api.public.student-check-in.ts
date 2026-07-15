// Public HTTP adapter for the student first-time check-in flow. Exists so
// tooling (load harness, uptime probes with a synthetic scenario, external
// integrations) can drive check-in over plain JSON instead of the TanStack
// server-fn RPC transport.
//
// This route is a thin shell: it validates input with the SAME Zod schema
// as the `studentCheckIn` server function and then delegates to that
// server function directly (server-side call = direct handler execution,
// no HTTP roundtrip). That guarantees:
//
//   • identical business logic (no divergent duplicate),
//   • identical `assertRateLimit("register", qrToken)` enforcement — the
//     shared-NAT budgets in `src/lib/rate-limit.server.ts` apply here too,
//   • identical response shapes (masked previews / states only, never PII
//     beyond what the public flow already returns).
//
// This route deliberately does NOT expose any bypass secret and does NOT
// weaken rate limits. Load harnesses must respect the same budgets a real
// venue full of phones would.
import { createFileRoute } from "@tanstack/react-router";
import { ZodError } from "zod";
import { studentCheckInInputSchema } from "@/lib/attendance-hq-schemas";
import { studentCheckIn } from "@/lib/attendance-hq.functions";

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

// The rate-limit helper throws `RateLimitedError` with `code === "rate_limited"`.
// We match on the code rather than instanceof so we don't have to import the
// class into a public route module (keeps the client graph tidy).
function isRateLimited(err: unknown): boolean {
  return (
    !!err &&
    typeof err === "object" &&
    (err as { code?: string }).code === "rate_limited"
  );
}

export const Route = createFileRoute("/api/public/student-check-in")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let raw: unknown;
        try {
          raw = await request.json();
        } catch {
          return json({ ok: false, error: "Invalid JSON body." }, 400);
        }

        let input: ReturnType<typeof studentCheckInInputSchema.parse>;
        try {
          input = studentCheckInInputSchema.parse(raw);
        } catch (err) {
          if (err instanceof ZodError) {
            return json(
              { ok: false, error: "Invalid input.", issues: err.issues.map((i) => ({ path: i.path, message: i.message })) },
              400,
            );
          }
          return json({ ok: false, error: "Invalid input." }, 400);
        }

        try {
          // Server-side invocation of the server fn runs the handler directly.
          // Same rate-limit budget, same DB writes, same response shape.
          const result = await studentCheckIn({ data: input });
          return json(result, 200);
        } catch (err) {
          if (isRateLimited(err)) {
            return json(
              { ok: false, code: "rate_limited", message: "Too many attempts. Please wait a moment and try again." },
              429,
            );
          }
          if (typeof console !== "undefined") {
            console.error("[api/public/student-check-in] handler failed", {
              message: (err as { message?: string })?.message,
            });
          }
          return json({ ok: false, error: "Something went wrong. Please try again." }, 500);
        }
      },
    },
  },
});
