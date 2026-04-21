import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { EventCard, EmptyStateBlock, FilterBar, ManagementPageShell, PageHeader, PrimaryButton, SearchInput, SelectInput, useRequireHostRedirect } from "@/components/attendance-hq/host-management";
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
    status: (search.status === "upcoming" || search.status === "past" ? search.status : "all") as EventListStatusFilter,
    query: typeof search.query === "string" ? search.query : "",
  }),
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    const [clubs, events] = await Promise.all([
      getHostClubSummaries(),
      getHostEvents({ data: deps }),
    ]);
    return { clubs, events };
  },
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
  const { clubs, events } = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/events" });

  if (loading || !user) return null;

  return (
    <ManagementPageShell>
      <div className="space-y-6 pb-20 md:pb-0">
        <PageHeader
          title="Events"
          description="View and manage upcoming and past events."
          action={<PrimaryButton asChild><a href="/events/new"><Plus className="h-4 w-4" />Create Event</a></PrimaryButton>}
        />
        <FilterBar>
          <SelectInput
            label="Club"
            value={search.clubId}
            onValueChange={(clubId) => navigate({ search: { ...search, clubId } })}
            placeholder="All Clubs"
            options={[{ value: "", label: "All Clubs" }, ...clubs.map((club: ClubSummary) => ({ value: club.id, label: club.club_name }))]}
          />
          <SelectInput
            label="Status"
            value={search.status}
            onValueChange={(status) => navigate({ search: { ...search, status: status as EventListStatusFilter } })}
            placeholder="All"
            options={[{ value: "all", label: "All" }, { value: "upcoming", label: "Upcoming" }, { value: "past", label: "Past" }]}
          />
          <SearchInput value={search.query} onChange={(query) => navigate({ search: { ...search, query } })} />
        </FilterBar>
        {events.length ? (
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {events.map((event: ManagementEventSummary) => <EventCard key={event.id} event={event} onDuplicate={(eventId) => navigate({ to: "/events/new", search: { duplicateFrom: eventId } })} />)}
          </div>
        ) : (
          <EmptyStateBlock
            title={search.clubId || search.status !== "all" || search.query ? "No matching events" : "No events yet"}
            description={search.clubId || search.status !== "all" || search.query ? "Try changing your filters." : "Create your first event to start tracking attendance."}
            action={<PrimaryButton asChild><a href="/events/new">Create Event</a></PrimaryButton>}
          />
        )}
      </div>
    </ManagementPageShell>
  );
}
