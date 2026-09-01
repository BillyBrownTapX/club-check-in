import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "event_attendance",
  title: "Event attendance",
  description: "Get the attendance roster and head count for one event the signed-in host manages.",
  inputSchema: {
    event_id: z.string().uuid().describe("The event id to report on."),
    limit: z.number().int().min(1).max(500).optional().describe("Maximum roster rows to return (default 100)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ event_id, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);

    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("id, event_name, event_date, start_time, end_time, location")
      .eq("id", event_id)
      .maybeSingle();
    if (eventError) return { content: [{ type: "text", text: eventError.message }], isError: true };
    if (!event) {
      return { content: [{ type: "text", text: "Event not found, or you do not have access to it." }], isError: true };
    }

    const { data, error, count } = await supabase
      .from("attendance_records")
      .select("checked_in_at, check_in_method, check_in_source, students(first_name, last_name, student_email)", {
        count: "exact",
      })
      .eq("event_id", event_id)
      .order("checked_in_at", { ascending: true })
      .limit(limit ?? 100);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    const roster = (data ?? []).map((row) => {
      const student = row.students as { first_name?: string; last_name?: string; student_email?: string } | null;
      return {
        name: [student?.first_name, student?.last_name].filter(Boolean).join(" "),
        email: student?.student_email ?? null,
        checked_in_at: row.checked_in_at,
        method: row.check_in_method,
        source: row.check_in_source,
      };
    });

    const summary = { event, total_check_ins: count ?? roster.length, roster };
    return {
      content: [{ type: "text", text: JSON.stringify(summary, null, 2) }],
      structuredContent: summary,
    };
  },
});
