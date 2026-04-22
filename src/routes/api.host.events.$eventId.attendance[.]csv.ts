// Streaming CSV export for an event's attendance roster.
//
// Why this is a server route (not a server fn):
//   The exportEventAttendance server fn used to build the entire CSV in
//   memory, JSON-encode it, ship it back, then have the client wrap it in a
//   Blob. For a 10k-row event that's MBs of double-encoded text held in
//   three places (server string, JSON wire payload, client string + Blob)
//   before the browser even shows a download dialog. Hosts on iPhones
//   noticed the lag.
//
//   A server route lets us stream the response body. We push CSV chunks
//   into a ReadableStream as we page through Supabase 1000 rows at a time,
//   so peak memory is ~one page regardless of event size, and the browser
//   shows the native download dialog the instant the headers arrive.
//
// Auth model:
//   The browser navigates to this URL via window.location.assign(...) when
//   the host clicks Export. That navigation cannot send an Authorization
//   header, so the host's Supabase access token is appended as ?token=...
//   The handler validates the token the same way auth-middleware does
//   (supabase.auth.getClaims), then issues a user-scoped Supabase client
//   so RLS enforces "hosts can only read attendance for their own events"
//   without us having to re-implement the ownership check.
//
//   The token is short-lived (Supabase default 1h), only used for this
//   single navigation, and never persisted in browser history (we use
//   location.assign in a hidden iframe-equivalent flow via <a> click).
//   Risk surface is the same as putting it in an Authorization header.

import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const CSV_HEADERS = [
  "First name",
  "Last name",
  "Student email",
  "900 number",
  "Checked in at",
  "Check-in method",
  "Event name",
  "Event date",
  "Location",
  "Club name",
] as const;

const METHOD_EXPORT_LABEL: Record<string, string> = {
  qr_scan: "First scan",
  returning_lookup: "Returning",
  remembered_device: "Remembered",
  host_correction: "Manual",
};

// Page size matches the Supabase default cap. Going higher requires an
// explicit `.range()` widening on the server and just shifts memory back
// onto our Worker — the streaming loop already handles arbitrary totals.
const PAGE_SIZE = 1000;

// UUID v4-ish guard. We keep it loose (any UUID format) so we don't reject
// valid event IDs from older migrations, but tight enough that path-traversal
// or SQL-shaped junk never reaches Supabase.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function escapeCsvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/[\",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function buildAttendanceFilename(eventName: string, eventDate: string) {
  const safeName = eventName.replace(/[^a-z0-9-_]+/gi, "_").slice(0, 60) || "event";
  return `${safeName}-attendance-${eventDate}.csv`;
}

// Single sanitized failure response. We never echo "token expired" vs
// "wrong scheme" vs "not your event" — same oracle-protection logic as
// the server-fn auth middleware.
function unauthorized() {
  return new Response("Unauthorized", { status: 401 });
}

type AttendanceRow = {
  checked_in_at: string;
  check_in_method: string | null;
  students: {
    first_name: string;
    last_name: string;
    student_email: string;
    nine_hundred_number: string | null;
  } | null;
};

export const Route = createFileRoute("/api/host/events/$eventId/attendance.csv")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const eventId = params.eventId;
        if (!UUID_RE.test(eventId)) return unauthorized();

        const url = new URL(request.url);
        const token = url.searchParams.get("token");
        if (!token) return unauthorized();

        const SUPABASE_URL = process.env.SUPABASE_URL;
        const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
          if (typeof console !== "undefined") {
            console.error("[csv-export] missing SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY");
          }
          return new Response("Service temporarily unavailable", { status: 500 });
        }

        // User-scoped client. RLS enforces that this host can only read
        // their own event + its attendance — same guard requireOwnedEvent
        // gives us in server fns, but expressed at the database layer.
        const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
        });

        const { data: claims, error: claimsError } = await supabase.auth.getClaims(token);
        if (claimsError || !claims?.claims?.sub) return unauthorized();

        // Fetch event header (for filename + denormalized columns). RLS will
        // return null if this host doesn't own the event — same effect as
        // notFound() in the server fn path.
        const { data: event, error: eventError } = await supabase
          .from("events")
          .select("event_name, event_date, location, clubs(club_name)")
          .eq("id", eventId)
          .maybeSingle();

        if (eventError || !event) return unauthorized();

        const clubName = (event.clubs as { club_name: string } | null)?.club_name ?? "";
        const filename = buildAttendanceFilename(event.event_name, event.event_date);
        const eventNameCell = escapeCsvCell(event.event_name);
        const eventDateCell = escapeCsvCell(event.event_date);
        const locationCell = escapeCsvCell(event.location ?? "");
        const clubNameCell = escapeCsvCell(clubName);

        const encoder = new TextEncoder();

        const stream = new ReadableStream<Uint8Array>({
          async start(controller) {
            try {
              // BOM so Excel auto-detects UTF-8 instead of Windows-1252.
              controller.enqueue(encoder.encode("\uFEFF"));
              controller.enqueue(
                encoder.encode(CSV_HEADERS.map(escapeCsvCell).join(",") + "\r\n"),
              );

              let offset = 0;
              // Page until Supabase returns fewer rows than PAGE_SIZE.
              // Using .range() instead of .limit() keeps the order stable
              // across pages (checked_in_at ASC + id tiebreaker).
              for (;;) {
                const { data: rows, error } = await supabase
                  .from("attendance_records")
                  .select(
                    "checked_in_at, check_in_method, students(first_name, last_name, student_email, nine_hundred_number)",
                  )
                  .eq("event_id", eventId)
                  .order("checked_in_at", { ascending: true })
                  .order("id", { ascending: true })
                  .range(offset, offset + PAGE_SIZE - 1);

                if (error) {
                  if (typeof console !== "undefined") {
                    console.error("[csv-export] page failed", error.message);
                  }
                  // Aborting the stream surfaces as a broken download in
                  // the browser. Better than emitting half a CSV and
                  // letting the host import garbage into Excel.
                  controller.error(new Error("Export failed"));
                  return;
                }

                const page = (rows ?? []) as AttendanceRow[];
                if (page.length === 0) break;

                // Build the chunk as one string per page so we hit the
                // controller once instead of per-row. Saves a lot of
                // syscall-equivalent overhead at 10k rows.
                const chunk = page
                  .map((row) =>
                    [
                      escapeCsvCell(row.students?.first_name),
                      escapeCsvCell(row.students?.last_name),
                      escapeCsvCell(row.students?.student_email),
                      escapeCsvCell(row.students?.nine_hundred_number),
                      escapeCsvCell(row.checked_in_at),
                      escapeCsvCell(
                        row.check_in_method
                          ? METHOD_EXPORT_LABEL[row.check_in_method] ?? row.check_in_method
                          : "",
                      ),
                      eventNameCell,
                      eventDateCell,
                      locationCell,
                      clubNameCell,
                    ].join(","),
                  )
                  .join("\r\n");

                controller.enqueue(encoder.encode(chunk + "\r\n"));

                if (page.length < PAGE_SIZE) break;
                offset += PAGE_SIZE;
              }

              controller.close();
            } catch (err) {
              if (typeof console !== "undefined") {
                console.error("[csv-export] stream failed", (err as Error)?.message);
              }
              controller.error(err);
            }
          },
        });

        return new Response(stream, {
          status: 200,
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="${filename}"`,
            // Don't cache — a host re-exporting after new check-ins must
            // always get the fresh roster.
            "Cache-Control": "no-store",
            // Hint to the browser that this is a real download, not an
            // inline preview.
            "X-Content-Type-Options": "nosniff",
          },
        });
      },
    },
  },
});
