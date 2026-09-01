// Streaming CSV export of every member (student) who has checked in or
// pre-checked in to ANY event across ALL clubs the signed-in host belongs to.
//
// Same shape as the per-event and semester exports:
//   - server route (not a server fn) so the browser can navigate to it and
//     use native download machinery
//   - short-lived ?token= for auth because window.location / <a> click can't
//     send an Authorization header
//   - user-scoped Supabase client, so RLS enforces "hosts only see data for
//     clubs they belong to" — no admin client, no re-implemented ownership.

import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const PAGE_SIZE = 1000;

const CSV_HEADERS = [
  "First name",
  "Last name",
  "Student email",
  "900 number",
  "University",
  "Clubs",
  "Events attended",
  "Pre-check-ins",
  "First check-in",
  "Last check-in",
] as const;

function escapeCsvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/[",\r\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function unauthorized() {
  return new Response("Unauthorized", { status: 401 });
}

type StudentRel = {
  id: string;
  first_name: string;
  last_name: string;
  student_email: string;
  nine_hundred_number: string | null;
  universities: { name: string } | null;
};

type MemberAgg = {
  firstName: string;
  lastName: string;
  studentEmail: string;
  nineHundredNumber: string;
  university: string;
  clubs: Set<string>;
  attendedEvents: Set<string>;
  preCheckedEvents: Set<string>;
  firstAt: string | null;
  lastAt: string | null;
};

export const Route = createFileRoute("/api/host/members.csv")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const token = url.searchParams.get("token");
        if (!token) return unauthorized();

        const SUPABASE_URL = process.env.SUPABASE_URL;
        const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
          if (typeof console !== "undefined") {
            console.error("[members-csv] missing SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY");
          }
          return new Response("Service temporarily unavailable", { status: 500 });
        }

        const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
        });

        const { data: claims, error: claimsError } = await supabase.auth.getClaims(token);
        if (claimsError || !claims?.claims?.sub) return unauthorized();

        // RLS-filtered: only clubs this host owns or is an officer of.
        const { data: clubsRaw, error: clubsError } = await supabase
          .from("clubs")
          .select("id, club_name");
        if (clubsError) return unauthorized();
        const clubs = (clubsRaw ?? []) as Array<{ id: string; club_name: string }>;
        const clubNameById = new Map(clubs.map((c) => [c.id, c.club_name]));

        const eventClubById = new Map<string, string>();
        if (clubs.length) {
          const { data: eventsRaw, error: eventsError } = await supabase
            .from("events")
            .select("id, club_id")
            .in(
              "club_id",
              clubs.map((c) => c.id),
            );
          if (eventsError) return unauthorized();
          for (const e of (eventsRaw ?? []) as Array<{ id: string; club_id: string }>) {
            eventClubById.set(e.id, e.club_id);
          }
        }

        const eventIds = Array.from(eventClubById.keys());
        const members = new Map<string, MemberAgg>();

        const upsert = (student: StudentRel, eventId: string) => {
          let entry = members.get(student.id);
          if (!entry) {
            entry = {
              firstName: student.first_name,
              lastName: student.last_name,
              studentEmail: student.student_email,
              nineHundredNumber: student.nine_hundred_number ?? "",
              university: student.universities?.name ?? "",
              clubs: new Set<string>(),
              attendedEvents: new Set<string>(),
              preCheckedEvents: new Set<string>(),
              firstAt: null,
              lastAt: null,
            };
            members.set(student.id, entry);
          }
          const clubId = eventClubById.get(eventId);
          const clubName = clubId ? clubNameById.get(clubId) : undefined;
          if (clubName) entry.clubs.add(clubName);
          return entry;
        };

        const touchTimes = (entry: MemberAgg, at: string) => {
          if (!entry.firstAt || at < entry.firstAt) entry.firstAt = at;
          if (!entry.lastAt || at > entry.lastAt) entry.lastAt = at;
        };

        const STUDENT_SELECT =
          "students(id, first_name, last_name, student_email, nine_hundred_number, universities(name))";

        async function page(
          table: "attendance_records" | "pre_check_ins",
          apply: (entry: MemberAgg, eventId: string) => void,
        ) {
          let offset = 0;
          for (;;) {
            const { data: rows, error } = await supabase
              .from(table)
              .select(`event_id, checked_in_at, ${STUDENT_SELECT}`)
              .in("event_id", eventIds)
              .order("checked_in_at", { ascending: true })
              .range(offset, offset + PAGE_SIZE - 1);
            if (error) {
              if (typeof console !== "undefined") {
                console.error(`[members-csv] ${table} page failed`, error.message);
              }
              throw new Error("Export failed");
            }
            const list = (rows ?? []) as unknown as Array<{
              event_id: string;
              checked_in_at: string;
              students: StudentRel | null;
            }>;
            for (const row of list) {
              if (!row.students) continue;
              const entry = upsert(row.students, row.event_id);
              apply(entry, row.event_id);
              touchTimes(entry, row.checked_in_at);
            }
            if (list.length < PAGE_SIZE) break;
            offset += PAGE_SIZE;
          }
        }

        if (eventIds.length) {
          try {
            await page("attendance_records", (entry, eventId) => {
              entry.attendedEvents.add(eventId);
            });
            await page("pre_check_ins", (entry, eventId) => {
              entry.preCheckedEvents.add(eventId);
            });
          } catch {
            return new Response("Export failed", { status: 500 });
          }
        }

        const sorted = Array.from(members.values()).sort((a, b) => {
          const ln = a.lastName.localeCompare(b.lastName);
          if (ln !== 0) return ln;
          return a.firstName.localeCompare(b.firstName);
        });

        const encoder = new TextEncoder();
        const today = new Date().toISOString().slice(0, 10);
        const filename = `attendance-hq-members-${today}.csv`;

        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            try {
              controller.enqueue(encoder.encode("\uFEFF"));
              controller.enqueue(
                encoder.encode(CSV_HEADERS.map(escapeCsvCell).join(",") + "\r\n"),
              );
              const CHUNK = 200;
              for (let i = 0; i < sorted.length; i += CHUNK) {
                const text = sorted
                  .slice(i, i + CHUNK)
                  .map((m) =>
                    [
                      escapeCsvCell(m.firstName),
                      escapeCsvCell(m.lastName),
                      escapeCsvCell(m.studentEmail),
                      escapeCsvCell(m.nineHundredNumber),
                      escapeCsvCell(m.university),
                      escapeCsvCell(Array.from(m.clubs).sort().join(", ")),
                      escapeCsvCell(m.attendedEvents.size),
                      escapeCsvCell(m.preCheckedEvents.size),
                      escapeCsvCell(m.firstAt ?? ""),
                      escapeCsvCell(m.lastAt ?? ""),
                    ].join(","),
                  )
                  .join("\r\n");
                controller.enqueue(encoder.encode(text + "\r\n"));
              }
              controller.close();
            } catch (err) {
              if (typeof console !== "undefined") {
                console.error("[members-csv] stream failed", (err as Error)?.message);
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
