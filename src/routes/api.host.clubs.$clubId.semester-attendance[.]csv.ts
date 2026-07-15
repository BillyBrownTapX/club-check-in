// Streaming CSV export for a club's semester attendance report (student ×
// meeting matrix). Mirrors the per-event export route:
//   - server route (not server fn) so the browser can navigate to it and
//     use native download machinery
//   - short-lived ?token= for auth because window.location can't send an
//     Authorization header
//   - user-scoped Supabase client, so RLS enforces "hosts can only read
//     data for clubs they belong to"
//
// Unlike the per-event export we can't stream row-by-row from a single
// query — the matrix requires knowing every event column before we can
// emit the first data row. We page attendance in memory-bounded chunks,
// aggregate by student, then flush the matrix. At the app's scale (dozens
// of meetings × hundreds of students) this fits comfortably in a Worker.

import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { getDefaultClubReportRange } from "@/lib/attendance-hq";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const PAGE_SIZE = 1000;

function escapeCsvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/[",\r\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function unauthorized() {
  return new Response("Unauthorized", { status: 401 });
}

function sanitizeName(value: string) {
  return value.replace(/[^a-z0-9-_]+/gi, "_").slice(0, 60) || "club";
}

export const Route = createFileRoute("/api/host/clubs/$clubId/semester-attendance.csv")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const clubId = params.clubId;
        if (!UUID_RE.test(clubId)) return unauthorized();

        const url = new URL(request.url);
        const token = url.searchParams.get("token");
        if (!token) return unauthorized();

        const fromParam = url.searchParams.get("from") ?? "";
        const toParam = url.searchParams.get("to") ?? "";
        const defaults = getDefaultClubReportRange();
        const fromDate = fromParam && DATE_RE.test(fromParam) ? fromParam : defaults.fromDate;
        const toDate = toParam && DATE_RE.test(toParam) ? toParam : defaults.toDate;

        const SUPABASE_URL = process.env.SUPABASE_URL;
        const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
          if (typeof console !== "undefined") {
            console.error("[club-report-csv] missing SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY");
          }
          return new Response("Service temporarily unavailable", { status: 500 });
        }

        const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
        });

        const { data: claims, error: claimsError } = await supabase.auth.getClaims(token);
        if (claimsError || !claims?.claims?.sub) return unauthorized();

        // RLS: only members/owners of the club see this row. Missing club →
        // treat as unauthorized (same oracle-protection as event route).
        const { data: club, error: clubError } = await supabase
          .from("clubs")
          .select("id, club_name")
          .eq("id", clubId)
          .maybeSingle();
        if (clubError || !club) return unauthorized();

        const { data: eventsRaw, error: eventsError } = await supabase
          .from("events")
          .select("id, event_name, event_date, start_time")
          .eq("club_id", clubId)
          .gte("event_date", fromDate)
          .lte("event_date", toDate)
          .order("event_date", { ascending: true })
          .order("start_time", { ascending: true });
        if (eventsError) return unauthorized();

        const events = (eventsRaw ?? []) as Array<{
          id: string;
          event_name: string;
          event_date: string;
        }>;
        const eventIds = events.map((e) => e.id);

        type StudentAgg = {
          firstName: string;
          lastName: string;
          studentEmail: string;
          nineHundredNumber: string;
          totalCheckIns: number;
          byEvent: Record<string, string | null>;
        };
        const students = new Map<string, StudentAgg>();

        if (eventIds.length) {
          let offset = 0;
          for (;;) {
            const { data: rows, error } = await supabase
              .from("attendance_records")
              .select(
                "event_id, checked_in_at, students(id, first_name, last_name, student_email, nine_hundred_number)",
              )
              .in("event_id", eventIds)
              .order("checked_in_at", { ascending: true })
              .range(offset, offset + PAGE_SIZE - 1);
            if (error) {
              if (typeof console !== "undefined") {
                console.error("[club-report-csv] attendance page failed", error.message);
              }
              return new Response("Export failed", { status: 500 });
            }
            const page = (rows ?? []) as Array<{
              event_id: string;
              checked_in_at: string;
              students: {
                id: string;
                first_name: string;
                last_name: string;
                student_email: string;
                nine_hundred_number: string | null;
              } | null;
            }>;
            for (const row of page) {
              const s = row.students;
              if (!s) continue;
              let entry = students.get(s.id);
              if (!entry) {
                entry = {
                  firstName: s.first_name,
                  lastName: s.last_name,
                  studentEmail: s.student_email,
                  nineHundredNumber: s.nine_hundred_number ?? "",
                  totalCheckIns: 0,
                  byEvent: Object.fromEntries(eventIds.map((id) => [id, null])),
                };
                students.set(s.id, entry);
              }
              if (!entry.byEvent[row.event_id]) {
                entry.byEvent[row.event_id] = row.checked_in_at;
                entry.totalCheckIns += 1;
              }
            }
            if (page.length < PAGE_SIZE) break;
            offset += PAGE_SIZE;
          }
        }

        const sorted = Array.from(students.values()).sort((a, b) => {
          const ln = a.lastName.localeCompare(b.lastName);
          if (ln !== 0) return ln;
          return a.firstName.localeCompare(b.firstName);
        });

        const header = [
          "First name",
          "Last name",
          "Student email",
          "900 number",
          ...events.map((e) => `${e.event_name} ${e.event_date}`),
          "Total check-ins",
        ]
          .map(escapeCsvCell)
          .join(",");

        const encoder = new TextEncoder();
        const filename = `${sanitizeName(club.club_name)}-semester-attendance-${fromDate}-to-${toDate}.csv`;

        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            try {
              controller.enqueue(encoder.encode("\uFEFF"));
              controller.enqueue(encoder.encode(header + "\r\n"));
              // Emit in reasonable chunks so we hit the controller once per
              // ~200 rows instead of per row.
              const CHUNK = 200;
              for (let i = 0; i < sorted.length; i += CHUNK) {
                const slice = sorted.slice(i, i + CHUNK);
                const text = slice
                  .map((s) => {
                    const matrix = events.map((e) => (s.byEvent[e.id] ? "X" : ""));
                    return [
                      escapeCsvCell(s.firstName),
                      escapeCsvCell(s.lastName),
                      escapeCsvCell(s.studentEmail),
                      escapeCsvCell(s.nineHundredNumber),
                      ...matrix.map(escapeCsvCell),
                      escapeCsvCell(s.totalCheckIns),
                    ].join(",");
                  })
                  .join("\r\n");
                controller.enqueue(encoder.encode(text + "\r\n"));
              }
              controller.close();
            } catch (err) {
              if (typeof console !== "undefined") {
                console.error("[club-report-csv] stream failed", (err as Error)?.message);
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
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
          },
        });
      },
    },
  },
});
