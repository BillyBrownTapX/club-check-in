import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_events",
  title: "List events",
  description: "List events for the signed-in host, newest first. Optionally filter by club.",
  inputSchema: {
    club_id: z.string().uuid().optional().describe("Only return events for this club id."),
    limit: z.number().int().min(1).max(100).optional().describe("Maximum number of events to return (default 20)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ club_id, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("events")
      .select(
        "id, event_name, event_date, start_time, end_time, location, club_id, is_active, is_archived, check_in_opens_at, check_in_closes_at, pre_check_in_enabled",
      )
      .order("event_date", { ascending: false })
      .limit(limit ?? 20);
    if (club_id) query = query.eq("club_id", club_id);
    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const events = data ?? [];
    return {
      content: [{ type: "text", text: events.length ? JSON.stringify(events, null, 2) : "No events found." }],
      structuredContent: { events },
    };
  },
});
