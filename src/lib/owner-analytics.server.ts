// Best-effort platform telemetry for the Owner Admin dashboard.
//
// Server-only. Every write is fire-and-forget: telemetry must NEVER change the
// outcome of a check-in or a host action, so all failures are swallowed (and
// logged) rather than thrown.
//
// Rows land in public.analytics_events, which is readable only through the
// owner_admin_* SQL reports (revoked from anon/authenticated).

export type PlatformEventType =
  | "check_in_failed"
  | "duplicate_check_in_attempt"
  | "rate_limited"
  | "server_error"
  | "feature_used";

type RecordArgs = {
  type: PlatformEventType;
  clubId?: string | null;
  eventId?: string | null;
  studentId?: string | null;
  userId?: string | null;
  metadata?: Record<string, unknown>;
};

export async function recordPlatformEvent(args: RecordArgs): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("analytics_events").insert({
      event_type: args.type,
      club_id: args.clubId ?? null,
      event_id: args.eventId ?? null,
      student_id: args.studentId ?? null,
      user_id: args.userId ?? null,
      // Never store PII here — operation names, reasons and counts only.
      metadata: (args.metadata ?? {}) as never,
    });
  } catch (error) {
    console.error("[analytics] failed to record", args.type, error);
  }
}

/** Records a feature touch for product-adoption reporting. */
export async function recordFeatureUsed(
  feature: string,
  opts: { clubId?: string | null; eventId?: string | null; userId?: string | null } = {},
): Promise<void> {
  await recordPlatformEvent({
    type: "feature_used",
    clubId: opts.clubId ?? null,
    eventId: opts.eventId ?? null,
    userId: opts.userId ?? null,
    metadata: { feature },
  });
}
