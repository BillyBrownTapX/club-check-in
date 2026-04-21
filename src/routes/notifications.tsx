import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Bell, CalendarCheck, UserCheck } from "lucide-react";
import { useAuthorizedServerFn } from "@/components/attendance-hq/auth-provider";
import { HostAppShell } from "@/components/attendance-hq/host-shell";
import { useRequireHostRedirect } from "@/components/attendance-hq/host-management";
import { GroupedList, LargeTitleHeader, ListRow, SectionLabel } from "@/components/attendance-hq/ios";
import { getHostEvents } from "@/lib/attendance-hq.functions";
import { formatEventDate, type ManagementEventSummary } from "@/lib/attendance-hq";

export const Route = createFileRoute("/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — Attendance HQ" },
      { name: "description", content: "Recent activity and event milestones." },
    ],
  }),
  component: NotificationsRoute,
});

function NotificationsRoute() {
  const { loading, user } = useRequireHostRedirect();
  const getEvents = useAuthorizedServerFn(getHostEvents);
  const [events, setEvents] = useState<ManagementEventSummary[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (loading || !user) return;
    let cancelled = false;
    void getEvents({ data: { clubId: "", status: "all", query: "" } })
      .then((next) => { if (!cancelled) setEvents(next); })
      .finally(() => { if (!cancelled) setFetching(false); });
    return () => { cancelled = true; };
  }, [getEvents, loading, user]);

  if (loading || !user) return <HostAppShell><div className="py-16 text-center text-sm text-muted-foreground">Loading…</div></HostAppShell>;

  const liveItems = events.filter((e) => e.checkInStatus === "open").slice(0, 5);
  const upcomingItems = events.filter((e) => e.checkInStatus === "upcoming").slice(0, 5);
  const recent = events.slice(0, 8);

  return (
    <HostAppShell>
      <LargeTitleHeader title="Activity" subtitle="Recent events and milestones." />

      {fetching ? (
        <div className="ios-card mt-3 rounded-3xl p-6 text-center text-sm text-muted-foreground">Loading…</div>
      ) : (
        <>
          {liveItems.length ? (
            <>
              <SectionLabel className="mt-3">Live</SectionLabel>
              <GroupedList>
                {liveItems.map((e) => (
                  <ListRow
                    key={e.id}
                    icon={Bell}
                    iconBg="bg-success/15"
                    iconColor="text-success"
                    label={`${e.event_name} is live`}
                    detail={`${e.attendanceCount ?? 0} checked in · ${e.clubs?.club_name ?? ""}`}
                    to="/events/$eventId"
                    params={{ eventId: e.id }}
                    search={{ created: "" }}
                  />
                ))}
              </GroupedList>
            </>
          ) : null}

          {upcomingItems.length ? (
            <>
              <SectionLabel className="mt-6">Up next</SectionLabel>
              <GroupedList>
                {upcomingItems.map((e) => (
                  <ListRow
                    key={e.id}
                    icon={CalendarCheck}
                    iconBg="bg-accent/15"
                    iconColor="text-accent-foreground"
                    label={`${e.event_name} opens soon`}
                    detail={formatEventDate(e.event_date)}
                    to="/events/$eventId"
                    params={{ eventId: e.id }}
                    search={{ created: "" }}
                  />
                ))}
              </GroupedList>
            </>
          ) : null}

          <SectionLabel className="mt-6">Recent events</SectionLabel>
          <GroupedList>
            {recent.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">Nothing yet.</div>
            ) : recent.map((e) => (
              <ListRow
                key={e.id}
                icon={UserCheck}
                label={e.event_name}
                detail={`${e.clubs?.club_name ?? ""} · ${formatEventDate(e.event_date)}`}
                value={`${e.attendanceCount ?? 0}`}
                to="/events/$eventId"
                params={{ eventId: e.id }}
                search={{ created: "" }}
              />
            ))}
          </GroupedList>
        </>
      )}
    </HostAppShell>
  );
}
