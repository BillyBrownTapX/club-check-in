import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Link, createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { Activity, CalendarPlus, ChevronRight, ListChecks, Plus, QrCode } from "lucide-react";
import { useAttendanceAuth, useAuthorizedQuery } from "@/components/attendance-hq/auth-provider";
import { HostAppShell, HomeTopActions } from "@/components/attendance-hq/host-shell";
import { useRequireHostRedirect, getManagementErrorMessage } from "@/components/attendance-hq/host-management";
import { ActionTile, Chip, GroupedList, LargeTitleHeader, ListRow, SectionLabel, StatTile } from "@/components/attendance-hq/ios";
import { InstallBanner } from "@/components/attendance-hq/install-cta";
import { Button } from "@/components/ui/button";
import { getHostClubSummaries, getHostEvents } from "@/lib/attendance-hq.functions";
import { formatEventDate, formatEventTime } from "@/lib/attendance-hq";
import { queryKeys } from "@/lib/query-keys";


function HomeError({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  return (
    <HostAppShell>
      <div className="ios-card mt-6 rounded-3xl p-6 text-center">
        <p className="text-sm text-destructive">{getManagementErrorMessage(error, "Unable to load home.")}</p>
        <Button className="mt-4" variant="hero" onClick={() => { router.invalidate(); reset(); }}>Try again</Button>
      </div>
    </HostAppShell>
  );
}

export const Route = createFileRoute("/home")({
  head: () => ({
    meta: [
      { title: "Home — Attendance HQ" },
      { name: "description", content: "Your live event command center." },
      { property: "og:title", content: "Home — Attendance HQ" },
      { property: "og:description", content: "Your live event command center." },
      { name: "twitter:title", content: "Home — Attendance HQ" },
      { name: "twitter:description", content: "Your live event command center." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: HomeRoute,
  errorComponent: HomeError,
});

function HomeRoute() {
  const { loading, user } = useRequireHostRedirect();
  const auth = useAttendanceAuth();
  const navigate = useNavigate();
  const [exporting, setExporting] = useState(false);

  // Full member export: every student who checked in or pre-checked in to
  // any event across all of this host's clubs. The CSV comes from a
  // streaming server route, so we hand the browser an anchor click and let
  // native download machinery take over (auth rides on a short-lived
  // ?token= because <a> clicks can't set an Authorization header).
  const handleExportMembers = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const accessToken = auth.session?.access_token;
      if (!accessToken) {
        toast.error("Your session expired. Please sign in again.");
        return;
      }
      const a = document.createElement("a");
      a.href = `/api/host/members.csv?token=${encodeURIComponent(accessToken)}`;
      a.rel = "noopener";
      a.download = "";
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.success("Member export started", { description: "Check your downloads." });
    } catch {
      toast.error("Export failed. Please try again.");
    } finally {
      setExporting(false);
    }
  };


  const clubsQuery = useAuthorizedQuery(
    queryKeys.clubs.summaries(),
    getHostClubSummaries,
    undefined,
    { staleTime: 30_000 },
  );
  const eventsQuery = useAuthorizedQuery(
    queryKeys.events.list({ clubId: "", status: "all", query: "" }),
    getHostEvents,
    { clubId: "", status: "all" as const, query: "" },
    { staleTime: 30_000 },
  );

  const clubs = clubsQuery.data ?? [];
  const events = eventsQuery.data ?? [];
  const fetching = clubsQuery.isLoading || eventsQuery.isLoading;
  const queryError = clubsQuery.error ?? eventsQuery.error;

  const greeting = useMemo(() => {
    const hr = new Date().getHours();
    return hr < 12 ? "Good morning" : hr < 17 ? "Good afternoon" : "Good evening";
  }, []);
  const firstName = useMemo(() => {
    const meta = (auth.user?.user_metadata ?? {}) as { full_name?: string };
    return (meta.full_name ?? auth.user?.email ?? "there").split(" ")[0];
  }, [auth.user]);

  const today = useMemo(() => new Date().toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" }), []);

  const liveEvent = useMemo(() => events.find((e) => e.checkInStatus === "open") ?? null, [events]);
  const upcomingEvent = useMemo(() => events.find((e) => e.checkInStatus === "upcoming") ?? null, [events]);
  const featuredEvent = liveEvent ?? upcomingEvent;

  const stats = useMemo(() => {
    const todayIso = new Date().toISOString().slice(0, 10);
    const checkInsToday = events
      .filter((e) => e.event_date === todayIso)
      .reduce((sum, e) => sum + (e.attendanceCount ?? 0), 0);
    const upcomingCount = events.filter((e) => e.checkInStatus === "upcoming" || e.checkInStatus === "open").length;
    return {
      activeClubs: clubs.filter((c) => c.is_active).length,
      checkInsToday,
      upcomingCount,
    };
  }, [clubs, events]);

  const recentEvents = useMemo(() => events.slice(0, 4), [events]);

  if (loading || !user) {
    return <HostAppShell><div className="py-20 text-center text-sm text-muted-foreground">Loading…</div></HostAppShell>;
  }

  return (
    <HostAppShell>
      <LargeTitleHeader
        eyebrow={today}
        title={`${greeting}, ${firstName}`}
        subtitle="Your live event command center."
        trailing={<HomeTopActions />}
      />

      {fetching ? (
        <div className="ios-card mt-2 rounded-3xl p-6 text-center text-sm text-muted-foreground">Loading your day…</div>
      ) : queryError ? (
        <div className="ios-card mt-2 rounded-3xl p-5 text-sm text-destructive">{getManagementErrorMessage(queryError, "Unable to load home.")}</div>
      ) : (
        <>
          <InstallBanner />

          {featuredEvent ? (
            <Link
              to="/events/$eventId"
              params={{ eventId: featuredEvent.id }}
              search={{ created: "" }}
              className="ios-press relative mt-3 block overflow-hidden rounded-[1.75rem]"
            >
              <div className="hero-wash p-5 text-white">
                <div className="blur-orb-gold -bottom-8 -right-6 h-28 w-28 opacity-50" />
                <div className="relative flex items-center justify-between gap-3">
                  <Chip tone={liveEvent ? "gold" : "blue"} className="border-white/30 bg-white/15 text-white">
                    {liveEvent ? "Live now" : "Up next"}
                  </Chip>
                  <ChevronRight className="h-5 w-5 text-white/80" />
                </div>
                <h2 className="relative mt-3 font-display text-[24px] font-extrabold leading-tight text-white">{featuredEvent.event_name}</h2>
                <p className="relative mt-1.5 text-[13px] text-white/85">{featuredEvent.clubs?.club_name}</p>
                <div className="relative mt-4 flex items-center gap-4 text-[13px] text-white/90">
                  <span>{formatEventDate(featuredEvent.event_date)}</span>
                  <span>·</span>
                  <span>{formatEventTime(featuredEvent.start_time, featuredEvent.end_time)}</span>
                </div>
                <div className="relative mt-4 flex items-center gap-3">
                  <div className="rounded-2xl bg-white/15 px-3 py-2 text-[12px]">
                    <span className="opacity-80">Checked in</span>
                    <span className="ml-2 font-display text-[16px] font-extrabold">{featuredEvent.attendanceCount ?? 0}</span>
                  </div>
                </div>
              </div>
            </Link>
          ) : (
            <div className="ios-card mt-3 flex flex-col items-start gap-3 rounded-[1.75rem] p-5">
              <Chip tone="muted">No live event</Chip>
              <h2 className="font-display text-[20px] font-extrabold text-foreground">Set up your next event</h2>
              <p className="text-[14px] text-muted-foreground">Create an event to start collecting check-ins.</p>
              <Link
                to="/events/new"
                search={{ clubId: "", templateId: "", duplicateFrom: "" }}
                className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-[13px] font-bold text-accent-foreground ios-cta-shadow-gold ios-press"
              >
                <Plus className="h-4 w-4" /> Create event
              </Link>
            </div>
          )}

          <SectionLabel className="mt-7">Membership &amp; growth</SectionLabel>
          {metricsQuery.isLoading && !metrics ? (
            <div className="grid grid-cols-2 gap-3" aria-hidden>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="ios-card rounded-2xl p-4">
                  <div className="h-3 w-1/2 animate-pulse rounded-full bg-muted" />
                  <div className="mt-3 h-7 w-2/3 animate-pulse rounded-lg bg-muted" />
                  <div className="mt-2 h-3 w-3/4 animate-pulse rounded-full bg-muted" />
                </div>
              ))}
            </div>
          ) : metricsQuery.error ? (
            <div className="ios-card rounded-2xl p-4 text-[13px] text-muted-foreground">
              {getManagementErrorMessage(metricsQuery.error, "Unable to load membership metrics.")}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={handleExportMembers} className="ios-press text-left">
                <StatTile
                  label="Members"
                  value={metrics?.totalMembers ?? 0}
                  hint={
                    metrics
                      ? `${metrics.membersWithEmail} email contacts · tap to export`
                      : "Check-ins + pre-check-ins"
                  }
                  icon={Users}
                  tone="blue"
                />
              </button>
              <StatTile
                label="Retention"
                value={metrics?.retentionPct === null || metrics === undefined ? "—" : `${metrics.retentionPct}%`}
                hint={
                  metrics && metrics.retentionEligible > 0
                    ? `${metrics.retentionReturned} of ${metrics.retentionEligible} returned`
                    : "Needs two past events"
                }
                icon={Repeat}
                tone="default"
              />
              <StatTile
                label="Event success"
                value={metrics?.eventSuccessPct === null || metrics === undefined ? "—" : `${metrics.eventSuccessPct}%`}
                hint={
                  metrics && metrics.pastEventCount > 0
                    ? `Avg ${metrics.avgAttendancePerEvent} per event · ${metrics.pastEventCount} held`
                    : "After your first event"
                }
                icon={Target}
                tone="gold"
              />
              <StatTile
                label="Growth 30d"
                value={
                  metrics?.growthRatePct === null || metrics === undefined
                    ? "—"
                    : `${metrics.growthRatePct > 0 ? "+" : ""}${metrics.growthRatePct}%`
                }
                hint={metrics ? `${metrics.newMembers30d} new · ${metrics.newMembersPrior30d} prior 30d` : "New members"}
                icon={metrics && (metrics.growthRatePct ?? 0) < 0 ? TrendingDown : TrendingUp}
                tone={metrics && (metrics.growthRatePct ?? 0) < 0 ? "default" : "success"}
              />
            </div>
          )}

          <div className="mt-3 -mx-1 flex gap-3 overflow-x-auto px-1 pb-1 scrollbar-none snap-x">
            <div className="snap-start"><StatTile label="Today" value={stats.checkInsToday} hint="Check-ins" tone="default" /></div>
            <div className="snap-start"><StatTile label="Upcoming" value={stats.upcomingCount} hint="Events on deck" tone="default" /></div>
            <div className="snap-start"><StatTile label="Clubs" value={stats.activeClubs} hint="Active" tone="default" /></div>
          </div>

          <SectionLabel className="mt-7">Quick actions</SectionLabel>
          <div className="grid grid-cols-2 gap-3">
            <ActionTile icon={CalendarPlus} label="Create event" hint="Start a new meeting" tone="default" to="/events/new" search={{ clubId: "", templateId: "", duplicateFrom: "" }} />
            <ActionTile icon={QrCode} label="Show QR" hint={featuredEvent ? "Open display" : "Pick an event"} tone="gold" onClick={() => featuredEvent ? navigate({ to: "/events/$eventId/display", params: { eventId: featuredEvent.id }, search: { created: "" } }) : navigate({ to: "/events", search: { clubId: "", status: "all", query: "" } })} />
            <ActionTile icon={Activity} label="Go live" hint="Live ops view" tone="blue" to="/live" />
            <ActionTile icon={ListChecks} label="View roster" hint={exporting ? "Preparing…" : "Export all members"} onClick={handleExportMembers} />
          </div>

          <SectionLabel className="mt-7">Recent events</SectionLabel>
          {recentEvents.length === 0 ? (
            <div className="ios-card rounded-2xl p-5 text-center text-[14px] text-muted-foreground">No events yet.</div>
          ) : (
            <GroupedList>
              {recentEvents.map((e) => (
                <ListRow
                  key={e.id}
                  icon={CalendarPlus}
                  label={e.event_name}
                  detail={`${e.clubs?.club_name ?? ""} · ${formatEventDate(e.event_date)}`}
                  to="/events/$eventId"
                  params={{ eventId: e.id }}
                  search={{ created: "" }}
                  trailing={<Chip tone={e.checkInStatus === "open" ? "success" : e.checkInStatus === "upcoming" ? "gold" : "muted"}>
                    {e.checkInStatus === "open" ? "Live" : e.checkInStatus === "upcoming" ? "Soon" : "Past"}
                  </Chip>}
                />
              ))}
            </GroupedList>
          )}
        </>
      )}
    </HostAppShell>
  );
}
