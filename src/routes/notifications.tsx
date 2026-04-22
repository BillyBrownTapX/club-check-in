import { createFileRoute, useRouter } from "@tanstack/react-router";
import { Bell, CalendarCheck, UserCheck } from "lucide-react";
import { useAuthorizedQuery } from "@/components/attendance-hq/auth-provider";
import { HostAppShell } from "@/components/attendance-hq/host-shell";
import { useRequireHostRedirect, getManagementErrorMessage } from "@/components/attendance-hq/host-management";
import { GroupedList, LargeTitleHeader, ListRow, SectionLabel } from "@/components/attendance-hq/ios";
import { Button } from "@/components/ui/button";
import { getHostEvents } from "@/lib/attendance-hq.functions";
import { formatEventDate } from "@/lib/attendance-hq";
import { queryKeys } from "@/lib/query-keys";

function NotificationsError({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  return (
    <HostAppShell>
      <div className="ios-card mt-6 rounded-3xl p-6 text-center">
        <p className="text-sm text-destructive">{getManagementErrorMessage(error, "Unable to load activity.")}</p>
        <Button className="mt-4" variant="hero" onClick={() => { router.invalidate(); reset(); }}>Try again</Button>
      </div>
    </HostAppShell>
  );
}

export const Route = createFileRoute("/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — Attendance HQ" },
      { name: "description", content: "Recent activity and event milestones." },
      { property: "og:title", content: "Notifications — Attendance HQ" },
      { property: "og:description", content: "Recent activity and event milestones." },
      { name: "twitter:title", content: "Notifications — Attendance HQ" },
      { name: "twitter:description", content: "Recent activity and event milestones." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: NotificationsRoute,
  errorComponent: NotificationsError,
});

function NotificationsRoute() {
  const { loading, user } = useRequireHostRedirect();

  // Reuses the same key as Home / Events list, so navigation between them is
  // instant — no extra fetch.
  const eventsQuery = useAuthorizedQuery(
    queryKeys.events.list({ clubId: "", status: "all", query: "" }),
    getHostEvents,
    { clubId: "", status: "all" as const, query: "" },
    { staleTime: 30_000 },
  );

  const events = eventsQuery.data ?? [];
  const fetching = eventsQuery.isLoading;

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
