import { useEffect, useMemo, useState } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { Activity, CalendarPlus, ChevronRight, ListChecks, Plus, QrCode } from "lucide-react";
import { useAttendanceAuth, useAuthorizedServerFn } from "@/components/attendance-hq/auth-provider";
import { HostAppShell, HomeTopActions } from "@/components/attendance-hq/host-shell";
import { useRequireHostRedirect, getManagementErrorMessage } from "@/components/attendance-hq/host-management";
import { ActionTile, Chip, GroupedList, LargeTitleHeader, ListRow, SectionLabel, StatTile } from "@/components/attendance-hq/ios";
import { InstallBanner } from "@/components/attendance-hq/install-cta";
import { getHostClubSummaries, getHostEvents } from "@/lib/attendance-hq.functions";
import { formatEventDate, formatEventTime, getCheckInStatus, type ClubSummary, type ManagementEventSummary } from "@/lib/attendance-hq";

export const Route = createFileRoute("/home")({
  head: () => ({
    meta: [
      { title: "Home — Attendance HQ" },
      { name: "description", content: "Your live event command center." },
    ],
  }),
  component: HomeRoute,
});

function HomeRoute() {
  const { loading, user } = useRequireHostRedirect();
  const auth = useAttendanceAuth();
  const getClubs = useAuthorizedServerFn(getHostClubSummaries);
  const getEvents = useAuthorizedServerFn(getHostEvents);
  const navigate = useNavigate();
  const [clubs, setClubs] = useState<ClubSummary[]>([]);
  const [events, setEvents] = useState<ManagementEventSummary[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading || !user) return;
    let cancelled = false;
    void Promise.all([getClubs(), getEvents({ data: { clubId: "", status: "all", query: "" } })])
      .then(([nextClubs, nextEvents]) => {
        if (cancelled) return;
        setClubs(nextClubs);
        setEvents(nextEvents);
      })
      .catch((e) => { if (!cancelled) setError(getManagementErrorMessage(e, "Unable to load home.")); })
      .finally(() => { if (!cancelled) setFetching(false); });
    return () => { cancelled = true; };
  }, [getClubs, getEvents, loading, user]);

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
      ) : error ? (
        <div className="ios-card mt-2 rounded-3xl p-5 text-sm text-destructive">{error}</div>
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

          <div className="mt-6 -mx-1 flex gap-3 overflow-x-auto px-1 pb-1 scrollbar-none snap-x">
            <div className="snap-start"><StatTile label="Today" value={stats.checkInsToday} hint="Check-ins" tone="default" /></div>
            <div className="snap-start"><StatTile label="Upcoming" value={stats.upcomingCount} hint="Events on deck" tone="blue" /></div>
            <div className="snap-start"><StatTile label="Clubs" value={stats.activeClubs} hint="Active" tone="gold" /></div>
          </div>

          <SectionLabel className="mt-7">Quick actions</SectionLabel>
          <div className="grid grid-cols-2 gap-3">
            <ActionTile icon={CalendarPlus} label="Create event" hint="Start a new meeting" tone="default" to="/events/new" search={{ clubId: "", templateId: "", duplicateFrom: "" }} />
            <ActionTile icon={QrCode} label="Show QR" hint={featuredEvent ? "Open display" : "Pick an event"} tone="gold" onClick={() => featuredEvent ? navigate({ to: "/events/$eventId/display", params: { eventId: featuredEvent.id }, search: { created: "" } }) : navigate({ to: "/events", search: { clubId: "", status: "all", query: "" } })} />
            <ActionTile icon={Activity} label="Go live" hint="Live ops view" tone="blue" to="/live" />
            <ActionTile icon={ListChecks} label="View roster" hint={liveEvent ? "Active event" : "Recent event"} onClick={() => featuredEvent ? navigate({ to: "/events/$eventId", params: { eventId: featuredEvent.id }, search: { created: "" } }) : navigate({ to: "/events", search: { clubId: "", status: "all", query: "" } })} />
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
