import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

function randomToken() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export default defineTool({
  name: "create_event",
  title: "Create event",
  description:
    "Create an event for one of the signed-in host's clubs. Times are local clock times (HH:MM) and the date is YYYY-MM-DD.",
  inputSchema: {
    club_id: z.string().uuid().describe("Club the event belongs to."),
    event_name: z.string().trim().min(1).max(120).describe("Event name."),
    event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Event date, YYYY-MM-DD."),
    start_time: z.string().regex(/^\d{2}:\d{2}$/).describe("Start time, HH:MM (24h)."),
    end_time: z.string().regex(/^\d{2}:\d{2}$/).describe("End time, HH:MM (24h)."),
    location: z.string().trim().max(160).optional().describe("Optional location."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  handler: async ({ club_id, event_name, event_date, start_time, end_time, location }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);

    const { data: club, error: clubError } = await supabase
      .from("clubs")
      .select("id, university_id")
      .eq("id", club_id)
      .maybeSingle();
    if (clubError) return { content: [{ type: "text", text: clubError.message }], isError: true };
    if (!club) {
      return { content: [{ type: "text", text: "Club not found, or you do not have access to it." }], isError: true };
    }

    const startsAt = new Date(`${event_date}T${start_time}:00Z`);
    const endsAt = new Date(`${event_date}T${end_time}:00Z`);
    if (!(endsAt.getTime() > startsAt.getTime())) {
      return { content: [{ type: "text", text: "End time must be after the start time." }], isError: true };
    }

    const { data, error } = await supabase
      .from("events")
      .insert({
        club_id,
        university_id: club.university_id,
        event_name,
        event_date,
        start_time,
        end_time,
        location: location ?? null,
        check_in_opens_at: new Date(startsAt.getTime() - 30 * 60_000).toISOString(),
        check_in_closes_at: new Date(endsAt.getTime() + 30 * 60_000).toISOString(),
        qr_token: randomToken(),
      })
      .select("id, event_name, event_date, start_time, end_time, location, qr_token")
      .single();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { event: data },
    };
  },
});
