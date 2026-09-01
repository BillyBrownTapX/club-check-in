import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_clubs",
  title: "List clubs",
  description: "List the clubs (organizations) the signed-in host can manage in Attendance HQ.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("clubs")
      .select("id, club_name, club_slug, description, is_active, created_at")
      .order("club_name", { ascending: true });
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const clubs = data ?? [];
    return {
      content: [{ type: "text", text: clubs.length ? JSON.stringify(clubs, null, 2) : "No clubs found for this account." }],
      structuredContent: { clubs },
    };
  },
});
