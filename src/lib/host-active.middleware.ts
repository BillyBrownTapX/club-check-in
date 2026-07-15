// Middleware chain that enforces "the caller is signed in AND their host
// account is not disabled by a campus admin". Compose this on any host
// mutation server fn (club/event/attendance writes). Read-only fns keep
// `requireSupabaseAuth` alone so a disabled host can still see their own
// dashboard / support their students during a recovery conversation.
//
// Public check-in server fns (qrToken students) do NOT use this — they run
// without auth entirely and must keep working mid-meeting even if the host
// dashboard is frozen.
import { createMiddleware } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function disabledResponse() {
  // Generic message — no oracle telling anonymous callers "you're disabled"
  // vs "you're not signed in". The signed-in host UI surfaces the reason.
  return new Response(
    JSON.stringify({ error: "This account is disabled. Contact campus support." }),
    { status: 403, headers: { "Content-Type": "application/json" } },
  );
}

function unavailable() {
  return new Response("Service temporarily unavailable", { status: 500 });
}

export const requireHostActive = createMiddleware({ type: "function" })
  .middleware([requireSupabaseAuth])
  .server(async ({ next, context }) => {
    // Use the admin client so we don't depend on host_profiles RLS letting
    // us read our own row (defense in depth — the current policy does, but
    // this check must survive future policy tightening).
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("host_profiles")
      .select("is_disabled")
      .eq("id", context.userId)
      .maybeSingle();

    if (error) {
      if (typeof console !== "undefined") {
        console.error("[host-active] lookup failed", error.message);
      }
      throw unavailable();
    }
    if (data?.is_disabled) {
      throw disabledResponse();
    }

    return next();
  });
