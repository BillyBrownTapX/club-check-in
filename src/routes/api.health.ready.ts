// Readiness probe. Confirms the Data API is reachable by issuing a tiny
// HEAD count against a stable, non-PII table (universities). Returns a
// deliberately generic `reason` string on failure — never a connection
// string, key, or table dump.
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export const Route = createFileRoute("/api/health/ready")({
  server: {
    handlers: {
      GET: async () => {
        const SUPABASE_URL = process.env.SUPABASE_URL;
        const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
          return json({ ok: false, status: "degraded", reason: "config" }, 503);
        }

        try {
          const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
            auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
          });
          const { error } = await supabase
            .from("universities")
            .select("id", { count: "exact", head: true })
            .limit(1);
          if (error) {
            if (typeof console !== "undefined") {
              console.error("[health-ready] db check failed", error.message);
            }
            return json({ ok: false, status: "degraded", reason: "database" }, 503);
          }
        } catch (err) {
          if (typeof console !== "undefined") {
            console.error("[health-ready] threw", (err as Error)?.message);
          }
          return json({ ok: false, status: "degraded", reason: "database" }, 503);
        }

        return json(
          { ok: true, status: "ready", checkedAt: new Date().toISOString() },
          200,
        );
      },
    },
  },
});
