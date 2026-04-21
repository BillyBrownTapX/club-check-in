import { useEffect, useMemo, useState } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { CalendarDays, Clock3, MapPin, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuthorizedServerFn } from "@/components/attendance-hq/auth-provider";
import { HostAppShell } from "@/components/attendance-hq/host-shell";
import { DeleteConfirmButton, useRequireHostRedirect } from "@/components/attendance-hq/host-management";
import { Chip, IosSearchField, LargeTitleHeader, SectionLabel, SegmentedControl } from "@/components/attendance-hq/ios";
import { Button } from "@/components/ui/button";
import { deleteEvent, getHostEvents } from "@/lib/attendance-hq.functions";
import { formatEventDate, formatEventTime, type EventListStatusFilter, type ManagementEventSummary } from "@/lib/attendance-hq";

export const Route = createFileRoute("/events/")({
  validateSearch: (search: Record<string, unknown>) => ({
    clubId: typeof search.clubId === "string" ? search.clubId : "",
    status: (["active", "upcoming", "past"].includes(String(search.status)) ? search.status : "all") as EventListStatusFilter,
    query: typeof search.query === "string" ? search.query : "",
  }),
  head: () => ({
    meta: [
      { title: "Events — Attendance HQ" },
      { name: "description", content: "Browse upcoming, live, and past events." },
    ],
  }),
  component: EventsRoute,
});

type Tab = "upcoming" | "live" | "past";

function EventsRoute() {
  const { loading, user } = useRequireHostRedirect();
  const getEvents = useAuthorizedServerFn(getHostEvents);
  const deleteEventMutation = useAuthorizedServerFn(deleteEvent);
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/events/" });
  const [events, setEvents] = useState<ManagementEventSummary[]>([]);
  const [fetching, setFetching] = useState(true);
  const [query, setQuery] = useState(search.query);
  const [tab, setTab] = useState<Tab>(search.status === "upcoming" ? "upcoming" : search.status === "active" ? "live" : search.status === "past" ? "past" : "upcoming");

  const handleDelete = async (eventId: string) => {
    await deleteEventMutation({ data: { eventId } });
    toast.success("Event deleted");
    const next = await getEvents({ data: { clubId: "", status: "all", query: "" } });
    setEvents(next);
  };

  useEffect(() => {
    if (loading || !user) return;
    let cancelled = false;
    setFetching(true);
    void getEvents({ data: { clubId: "", status: "all", query: "" } })
      .then((next) => { if (!cancelled) setEvents(next); })
      .finally(() => { if (!cancelled) setFetching(false); });
    return () => { cancelled = true; };
  }, [getEvents, loading, user]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return events.filter((e) => {
      if (tab === "live" && e.checkInStatus !== "open") return false;
      if (tab === "upcoming" && e.checkInStatus !== "upcoming") return false;
      if (tab === "past" && (e.checkInStatus === "open" || e.checkInStatus === "upcoming")) return false;
      if (!q) return true;
      return [e.event_name, e.clubs?.club_name, e.location].filter(Boolean).join(" ").toLowerCase().includes(q);
    });
  }, [events, query, tab]);

  if (loading || !user) return <HostAppShell><div className="py-16 text-center text-sm text-muted-foreground">Loading…</div></HostAppShell>;

  return (
    <HostAppShell>
      <LargeTitleHeader
        title="Events"
        subtitle="Plan, launch, and review every event."
        trailing={
          <Button asChild variant="hero" size="sm" className="rounded-full">
            <Link to="/events/new" search={{ clubId: "", templateId: "", duplicateFrom: "" }}>
              <Plus className="h-4 w-4" /> New
            </Link>
          </Button>
        }
      />

      <div className="mt-1 space-y-3">
        <IosSearchField value={query} onChange={(v) => { setQuery(v); navigate({ search: (prev) => ({ ...prev, query: v }) }); }} placeholder="Search events" />
        <SegmentedControl<Tab>
          value={tab}
          onChange={(t) => {
            setTab(t);
            navigate({ search: (prev) => ({ ...prev, status: t === "live" ? "active" : t === "upcoming" ? "upcoming" : "past" }) });
          }}
          options={[
            { value: "upcoming", label: "Upcoming" },
            { value: "live", label: "Live" },
            { value: "past", label: "Past" },
          ]}
        />
      </div>

      <div className="mt-5">
        {fetching ? (
          <div className="ios-card mt-3 rounded-3xl p-6 text-center text-sm text-muted-foreground">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="ios-card rounded-3xl p-8 text-center">
            <p className="font-display text-[18px] font-bold text-foreground">No {tab} events</p>
            <p className="mt-1 text-[13px] text-muted-foreground">{tab === "upcoming" ? "Create one to get started." : "Nothing to show here yet."}</p>
            {tab === "upcoming" ? (
              <Button asChild variant="hero" className="mt-5">
                <Link to="/events/new" search={{ clubId: "", templateId: "", duplicateFrom: "" }}>Create event</Link>
              </Button>
            ) : null}
          </div>
        ) : (
          <>
            <SectionLabel>{filtered.length} {filtered.length === 1 ? "event" : "events"}</SectionLabel>
            <div className="space-y-3">
              {filtered.map((e) => <EventCard key={e.id} event={e} onDelete={handleDelete} />)}
            </div>
          </>
        )}
      </div>
    </HostAppShell>
  );
}

function EventCard({ event, onDelete }: { event: ManagementEventSummary; onDelete: (eventId: string) => Promise<void> }) {
  const date = new Date(`${event.event_date}T00:00:00`);
  const month = date.toLocaleDateString("en-US", { month: "short" }).toUpperCase();
  const day = date.getDate();
  const tone = event.checkInStatus === "open" ? "success" : event.checkInStatus === "upcoming" ? "gold" : "muted";
  const label = event.checkInStatus === "open" ? "Live" : event.checkInStatus === "upcoming" ? "Upcoming" : event.checkInStatus === "archived" ? "Archived" : "Closed";

  return (
    <div className="relative">
      <Link
        to="/events/$eventId"
        params={{ eventId: event.id }}
        search={{ created: "" }}
        className="ios-card ios-press flex items-stretch gap-4 rounded-2xl p-3.5"
      >
        <div className="flex w-[64px] shrink-0 flex-col items-center justify-center rounded-xl bg-primary/10 text-primary">
          <span className="text-[10.5px] font-bold tracking-wider">{month}</span>
          <span className="font-display text-[24px] font-extrabold leading-none">{day}</span>
        </div>
        <div className="min-w-0 flex-1 py-0.5">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate font-display text-[16px] font-bold text-foreground">{event.event_name}</p>
            <Chip tone={tone}>{label}</Chip>
          </div>
          <p className="mt-0.5 truncate text-[12.5px] text-muted-foreground">{event.clubs?.club_name ?? "Club event"}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted-foreground">
            <span className="inline-flex items-center gap-1"><Clock3 className="h-3 w-3" />{formatEventTime(event.start_time, event.end_time)}</span>
            {event.location ? <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{event.location}</span> : null}
            <span className="inline-flex items-center gap-1"><CalendarDays className="h-3 w-3" />{formatEventDate(event.event_date)}</span>
          </div>
          <div className="mt-2 flex items-center justify-between gap-2">
            <div className="text-[12px] font-semibold text-primary">{event.attendanceCount ?? 0} checked in</div>
          </div>
        </div>
      </Link>
      <div
        className="absolute bottom-2 right-2"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
      >
        <DeleteConfirmButton
          trigger={
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive"
              aria-label="Delete event"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          }
          title="Delete this event?"
          description="This permanently removes the event, its attendance records, and action history. This cannot be undone."
          onConfirm={() => onDelete(event.id)}
        />
      </div>
    </div>
  );
}
