import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listClubsTool from "./tools/list-clubs";
import listEventsTool from "./tools/list-events";
import eventAttendanceTool from "./tools/event-attendance";
import createEventTool from "./tools/create-event";

// The OAuth issuer must be the direct Supabase host; the project ref is the
// only value that survives publish unchanged.
const projectRef = import.meta.env['VITE_SUPABASE_PROJECT_ID'] ?? "project-ref-unset";

export default defineMcp({
  name: "attendance-hq",
  title: "Attendance HQ",
  version: "0.1.0",
  instructions:
    "Tools for Attendance HQ, a campus event check-in app. Use `list_clubs` to find the signed-in host's organizations, `list_events` to find their events, `event_attendance` for a head count and roster, and `create_event` to schedule a new event.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listClubsTool, listEventsTool, eventAttendanceTool, createEventTool],
});
