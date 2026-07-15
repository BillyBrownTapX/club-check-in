import { createFileRoute, useRouter } from "@tanstack/react-router";
import { CheckCircle2, Sparkles, Trophy } from "lucide-react";
import { useAuthorizedQuery } from "@/components/attendance-hq/auth-provider";
import { HostAppShell } from "@/components/attendance-hq/host-shell";
import { useRequireHostRedirect, getManagementErrorMessage } from "@/components/attendance-hq/host-management";
import { GroupedList, LargeTitleHeader, ListRow } from "@/components/attendance-hq/ios";
import { Button } from "@/components/ui/button";
import { getHostActivity } from "@/lib/attendance-hq.functions";
import type { HostActivityEntry } from "@/lib/attendance-hq";
import { formatTimestamp } from "@/lib/attendance-hq";
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
      { name: "description", content: "Real event milestones from your clubs." },
      { property: "og:title", content: "Notifications — Attendance HQ" },
      { property: "og:description", content: "Real event milestones from your clubs." },
      { name: "twitter:title", content: "Notifications — Attendance HQ" },
      { name: "twitter:description", content: "Real event milestones from your clubs." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: NotificationsRoute,
  errorComponent: NotificationsError,
});

function describeEntry(entry: HostActivityEntry): { icon: typeof Sparkles; iconBg: string; iconColor: string; label: string; detail: string } {
  const eventName = entry.event.eventName;
  const clubName = entry.club.clubName;
  const when = formatTimestamp(entry.createdAt);
  switch (entry.activityType) {
    case "first_check_in":
      return {
        icon: Sparkles,
        iconBg: "bg-success/15",
        iconColor: "text-success",
        label: `First check-in at ${eventName}`,
        detail: `${clubName} · ${when}`,
      };
    case "threshold_reached":
      return {
        icon: Trophy,
        iconBg: "bg-accent/15",
        iconColor: "text-accent-foreground",
        label: `${eventName} reached ${entry.threshold ?? "—"} check-ins`,
        detail: `${clubName} · ${when}`,
      };
    case "check_in_closed": {
      const count = entry.attendanceCount ?? 0;
      return {
        icon: CheckCircle2,
        iconBg: "bg-muted",
        iconColor: "text-muted-foreground",
        label: `Check-in closed for ${eventName}`,
        detail: `${count} checked in · ${clubName} · ${when}`,
      };
    }
  }
}

function NotificationsRoute() {
  const { loading, user } = useRequireHostRedirect();

  const activityQuery = useAuthorizedQuery<HostActivityEntry[]>(
    queryKeys.activity.feed(),
    getHostActivity,
    undefined,
    { staleTime: 15_000 },
  );

  const entries = activityQuery.data ?? [];
  const fetching = activityQuery.isLoading;

  if (loading || !user) return <HostAppShell><div className="py-16 text-center text-sm text-muted-foreground">Loading…</div></HostAppShell>;

  return (
    <HostAppShell>
      <LargeTitleHeader
        title="Activity"
        subtitle="First check-ins, attendance milestones, and check-in closed events."
      />

      {fetching ? (
        <div className="ios-card mt-3 rounded-3xl p-6 text-center text-sm text-muted-foreground">Loading…</div>
      ) : entries.length === 0 ? (
        <div className="ios-card mt-3 rounded-3xl p-8 text-center">
          <p className="text-sm font-medium">No activity yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Milestones show up here when students check in or when you close check-in.
          </p>
        </div>
      ) : (
        <GroupedList className="mt-3">
          {entries.map((entry) => {
            const meta = describeEntry(entry);
            return (
              <ListRow
                key={entry.id}
                icon={meta.icon}
                iconBg={meta.iconBg}
                iconColor={meta.iconColor}
                label={meta.label}
                detail={meta.detail}
                to="/events/$eventId"
                params={{ eventId: entry.event.id }}
                search={{ created: "" }}
              />
            );
          })}
        </GroupedList>
      )}
    </HostAppShell>
  );
}
