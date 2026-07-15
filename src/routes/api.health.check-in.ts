// Public check-in dependency probe. Confirms the service-role admin client
// (which the public /check-in/$qrToken flow depends on) can talk to the
// database. Reads a lightweight non-PII surface (events HEAD count) — no
// qrToken required, no attendance writes, no student data returned.
import { createFileRoute } from "@tanstack/react-router";

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export const Route = createFileRoute("/api/health/check-in")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { error } = await supabaseAdmin
            .from("events")
            .select("id", { count: "exact", head: true })
            .limit(1);
          if (error) {
            if (typeof console !== "undefined") {
              console.error("[health-check-in] admin read failed", error.message);
            }
            return json({ ok: false, status: "degraded", reason: "database" }, 503);
          }
        } catch (err) {
          if (typeof console !== "undefined") {
            console.error("[health-check-in] threw", (err as Error)?.message);
          }
          return json({ ok: false, status: "degraded", reason: "admin_client" }, 503);
        }

        return json(
          { ok: true, status: "ok", checkedAt: new Date().toISOString() },
          200,
        );
      },
    },
  },
});
