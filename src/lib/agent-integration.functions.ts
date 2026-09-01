import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PRODUCTION_APP_ORIGIN } from "@/lib/attendance-hq";

export const AGENT_SETUP_PATH = "/agents";

/**
 * Emails the signed-in host their own agent setup link. The recipient is always
 * the address on the caller's host profile — never taken from client input.
 */
export const emailAgentSetupLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile, error } = await supabaseAdmin
      .from("host_profiles")
      .select("email, full_name, is_disabled")
      .eq("id", context.userId)
      .maybeSingle();

    if (error || !profile) throw new Error("Host profile not found");
    if (profile.is_disabled) throw new Error("This account is disabled");

    const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
    const setupUrl = `${PRODUCTION_APP_ORIGIN}${AGENT_SETUP_PATH}`;
    const firstName = profile.full_name?.trim().split(/\s+/)[0] ?? "";

    const result = await sendTemplateEmail("agent-setup-link", profile.email, {
      templateData: { hostName: firstName, setupUrl },
      // One send per host per day; repeat clicks in the same day dedupe.
      idempotencyKey: `agent-setup-link-${context.userId}-${new Date().toISOString().slice(0, 10)}`,
    });

    if (!result.sent) {
      return { sent: false as const, email: profile.email, reason: "suppressed" as const };
    }

    return { sent: true as const, email: profile.email };
  });
