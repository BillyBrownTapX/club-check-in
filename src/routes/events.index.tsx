import { useEffect, useMemo, useState } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { EventCard, EmptyStateBlock, FilterBar, ManagementPageShell, PageHeader, PrimaryButton, SearchInput, SelectInput, getManagementErrorMessage, useRequireHostRedirect } from "@/components/attendance-hq/host-management";
import { useAuthorizedServerFn } from "@/components/attendance-hq/auth-provider";
import { getHostClubSummaries, getHostEvents } from "@/lib/attendance-hq.functions";
import type { ClubSummary, EventListStatusFilter, ManagementEventSummary } from "@/lib/attendance-hq";

function EventsNotFound() {
  return <ManagementPageShell><div className="py-16 text-center text-sm text-muted-foreground">Events not found.</div></ManagementPageShell>;
}

function EventsError({ error }: { error: Error }) {
  return <ManagementPageShell><div className="py-16 text-center text-sm text-muted-foreground">{error.message}</div></ManagementPageShell>;
}

export const Route = createFileRoute("/events/")({
  validateSearch: (search: Record<string, unknown>) => ({
    clubId: typeof search.clubId === "string" ? search.clubId : "",
    status: (["active", "upcoming", "past"].includes(String(search.status)) ? search.status : "all") as EventListStatusFilter,
    query: typeof search.query === "string" ? search.query : "",
  }),
  errorComponent: EventsError,
  notFoundComponent: EventsNotFound,
  head: () => ({
    meta: [
      { title: "Events — Attendance HQ" },
      { name: "description", content: "View and manage upcoming and past events." },
    ],
  }),
  component: EventsRoute,
});

function EventsRoute() {
  const { loading, user } = useRequireHostRedirect();
  const getClubs = useAuthorizedServerFn(getHostClubSummaries);
  const getEvents = useAuthorizedServerFn(getHostEvents);
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/events/" });
  const [clubs, setClubs] = useState<ClubSummary[]>([]);
  const [events, setEvents] = useState<ManagementEventSummary[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading || !user) return;
    let cancelled = false;

    const load = async () => {
      setFetching(true);
      setError(null);
      try {
        const [nextClubs, nextEvents] = await Promise.all([
          getClubs(),
          getEvents({ data: search }),
        ]);
        if (!cancelled) {
          setClubs(nextClubs);
          setEvents(nextEvents);
        }
      } catch (loadError) {
        if (!cancelled) setError(getManagementErrorMessage(loadError, "Unable to load events."));
      } finally {
        if (!cancelled) setFetching(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [getClubs, getEvents, loading, search, user]);

  const groupedEvents = useMemo(() => {
    const groups = {
      open: [] as ManagementEventSummary[],
      upcoming: [] as ManagementEventSummary[],
      past: [] as ManagementEventSummary[],
      archived: [] as ManagementEventSummary[],
    };
    for (const event of events) {
      if (event.checkInStatus === "open") groups.open.push(event);
      else if (event.checkInStatus === "upcoming") groups.upcoming.push(event);
      else if (event.checkInStatus === "archived") groups.archived.push(event);
      else groups.past.push(event);
    }
    return groups;
  }, [events]);

  if (loading || !user) return <ManagementPageShell><div className="py-16 text-center text-sm text-muted-foreground">Loading your events…</div></ManagementPageShell>;

  return (
    <ManagementPageShell>
      <div className="space-y-5 pb-20 md:pb-0">
        <PageHeader
          title="Events"
          description="Run live meetings, monitor check-ins, and jump into the right ops console fast from your phone."
          action={<PrimaryButton asChild><Link to="/events/new" search={{ clubId: "", templateId: "", duplicateFrom: "" }}><Plus className="h-4 w-4" />Create Event</Link></PrimaryButton>}
        />
        <FilterBar>
          <SelectInput
            label="Club"
            value={search.clubId}
            onValueChange={(clubId) => navigate({ search: (prev) => ({ ...prev, clubId }) })}
            placeholder="All Clubs"
            options={[{ value: "", label: "All Clubs" }, ...clubs.map((club: ClubSummary) => ({ value: club.id, label: club.club_name }))]}
          />
          <SelectInput
            label="Focus"
            value={search.status}
            onValueChange={(status) => navigate({ search: (prev) => ({ ...prev, status: status as EventListStatusFilter }) })}
            placeholder="All"
            options={[
              { value: "all", label: "All Events" },
              { value: "active", label: "Open + Upcoming" },
              { value: "upcoming", label: "Upcoming Only" },
              { value: "past", label: "Past + Closed" },
            ]}
          />
          <SearchInput value={search.query} onChange={(query) => navigate({ search: (prev) => ({ ...prev, query }) })} />
        </FilterBar>
        {fetching ? (
          <div className="py-16 text-center text-sm text-muted-foreground">Loading your events…</div>
        ) : error ? (
          <EventsError error={new Error(error)} />
        ) : events.length ? (
          search.status === "all" ? (
            <div className="space-y-8">
              <EventSection title="Open now" description="These meetings are actively accepting check-ins." events={groupedEvents.open} navigate={navigate} />
              <EventSection title="Upcoming" description="Ready for the next student arrival wave." events={groupedEvents.upcoming} navigate={navigate} />
              <EventSection title="Review queue" description="Closed or inactive events ready for export and cleanup." events={groupedEvents.past} navigate={navigate} />
              {groupedEvents.archived.length ? <EventSection title="Archived" description="Stored for historical reference." events={groupedEvents.archived} navigate={navigate} /> : null}
            </div>
          ) : (
            <div className="grid gap-4 xl:grid-cols-3">
              {events.map((event) => <EventCard key={event.id} event={event} onDuplicate={(eventId) => navigate({ to: "/events/new", search: { clubId: event.club_id, templateId: "", duplicateFrom: eventId } })} />)}
            </div>
          )
        ) : (
          <EmptyStateBlock
            title={search.clubId || search.status !== "all" || search.query ? "No matching events" : "No events yet"}
            description={search.clubId || search.status !== "all" || search.query ? "Try changing your filters." : "Create your first event to start tracking attendance."}
            action={<PrimaryButton asChild><Link to="/events/new" search={{ clubId: "", templateId: "", duplicateFrom: "" }}>Create Event</Link></PrimaryButton>}
          />
        )}
      </div>
    </ManagementPageShell>
  );
}

function EventSection({
  title,
  description,
  events,
  navigate,
}: {
  title: string;
  description: string;
  events: ManagementEventSummary[];
  navigate: ReturnType<typeof useNavigate>;
}) {
  if (!events.length) return null;
  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        {events.map((event) => <EventCard key={event.id} event={event} onDuplicate={(eventId) => navigate({ to: "/events/new", search: { clubId: event.club_id, templateId: "", duplicateFrom: eventId } })} />)}
      </div>
    </section>
  );
}
