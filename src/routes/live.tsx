import { useEffect, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Activity, ListChecks, QrCode } from "lucide-react";
import { useAuthorizedServerFn } from "@/components/attendance-hq/auth-provider";
import { HostAppShell } from "@/components/attendance-hq/host-shell";
import { useRequireHostRedirect } from "@/components/attendance-hq/host-management";
import { Chip, LargeTitleHeader, SectionLabel, StatTile } from "@/components/attendance-hq/ios";
import { Button } from "@/components/ui/button";
import { getHostEvents } from "@/lib/attendance-hq.functions";
import { formatEventDate, formatEventTime, type ManagementEventSummary } from "@/lib/attendance-hq";

export const Route = createFileRoute("/live")({
  head: () => ({
    meta: [
      { title: "Live — Attendance HQ" },
      { name: "description", content: "Live event operations." },
    ],
  }),
  component: LiveRoute,
});

function LiveRoute() {
  const { loading, user } = useRequireHostRedirect();
  const getEvents = useAuthorizedServerFn(getHostEvents);
  const [events, setEvents] = useState<ManagementEventSummary[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (loading || !user) return;
    let cancelled = false;
    void getEvents({ data: { clubId: "", status: "active", query: "" } })
      .then((next) => { if (!cancelled) setEvents(next); })
      .finally(() => { if (!cancelled) setFetching(false); });
    return () => { cancelled = true; };
  }, [getEvents, loading, user]);

  const live = events.find((e) => e.checkInStatus === "open") ?? null;
  const queued = events.filter((e) => e.checkInStatus === "upcoming");

  if (loading || !user) return <HostAppShell><div className="py-16 text-center text-sm text-muted-foreground">Loading…</div></HostAppShell>;

  return (
    <HostAppShell>
      <LargeTitleHeader eyebrow="Operations" title="Live" subtitle="Active event control." />

      {fetching ? (
        <div className="ios-card mt-3 rounded-3xl p-6 text-center text-sm text-muted-foreground">Loading…</div>
      ) : !live ? (
        <div className="mt-3 space-y-4">
          <div className="ios-card rounded-3xl p-6 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Activity className="h-6 w-6" />
            </div>
            <h2 className="mt-4 font-display text-[20px] font-extrabold text-foreground">No event is live</h2>
            <p className="mt-1.5 text-[14px] leading-6 text-muted-foreground">Open check-in on an event to see live operations here.</p>
            <Button asChild variant="hero" className="mt-5"><Link to="/events" search={{ clubId: "", status: "all", query: "" }}>View events</Link></Button>
          </div>

          {queued.length > 0 ? (
            <>
              <SectionLabel className="mt-3">Coming up</SectionLabel>
              <div className="ios-grouped">
                {queued.map((e) => (
                  <Link key={e.id} to="/events/$eventId" params={{ eventId: e.id }} search={{ created: "" }} className="ios-list-row">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/15 text-accent-foreground"><Activity className="h-4 w-4" /></div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[15px] font-medium text-foreground">{e.event_name}</div>
                      <div className="text-[13px] text-muted-foreground">{formatEventDate(e.event_date)} · {formatEventTime(e.start_time, e.end_time)}</div>
                    </div>
                    <Chip tone="gold">Soon</Chip>
                  </Link>
                ))}
              </div>
            </>
          ) : null}
        </div>
      ) : (
        <div className="mt-3 space-y-4">
          <div className="relative overflow-hidden rounded-[1.75rem] hero-wash p-5 text-white">
            <div className="blur-orb-gold -bottom-10 -right-6 h-32 w-32 opacity-60" />
            <div className="flex items-center justify-between gap-3">
              <Chip tone="gold" className="border-white/30 bg-white/15 text-white">
                <span className="inline-flex h-2 w-2 rounded-full bg-success" />
                Live now
              </Chip>
              <Link to="/events/$eventId/display" params={{ eventId: live.id }} search={{ created: "" }} className="text-[13px] font-semibold text-white/90 underline-offset-2 hover:underline">
                Open display
              </Link>
            </div>
            <h2 className="relative mt-3 font-display text-[26px] font-extrabold leading-tight text-white">{live.event_name}</h2>
            <p className="relative mt-1 text-[13px] text-white/85">{live.clubs?.club_name}</p>
            <div className="relative mt-5 flex items-end gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider opacity-80">Checked in</p>
                <p className="font-display text-[44px] font-black leading-none">{live.attendanceCount ?? 0}</p>
              </div>
              <div className="ml-auto text-right text-[12px] opacity-85">
                <p>{formatEventTime(live.start_time, live.end_time)}</p>
                <p>{formatEventDate(live.event_date)}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <StatTile label="Status" value="Open" tone="success" />
            <StatTile label="Attendance" value={live.attendanceCount ?? 0} tone="blue" />
          </div>

          <div className="ios-glass sticky bottom-[5.5rem] z-10 grid grid-cols-3 gap-2 rounded-2xl p-2.5">
            <Button asChild variant="hero" size="sm" className="rounded-xl">
              <Link to="/events/$eventId/display" params={{ eventId: live.id }} search={{ created: "" }}><QrCode className="h-4 w-4" /> QR</Link>
            </Button>
            <Button asChild variant="default" size="sm" className="rounded-xl">
              <Link to="/events/$eventId" params={{ eventId: live.id }} search={{ created: "" }}><ListChecks className="h-4 w-4" /> Roster</Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="rounded-xl">
              <Link to="/events/$eventId/edit" params={{ eventId: live.id }} search={{ created: "" }}>Edit</Link>
            </Button>
          </div>
        </div>
      )}
    </HostAppShell>
  );
}
