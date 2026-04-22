import { useEffect } from "react";
import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useAuthorizedMutation, useAuthorizedQuery } from "@/components/attendance-hq/auth-provider";
import { Button } from "@/components/ui/button";
import {
  EventForm,
  ManagementPageShell,
  getManagementErrorMessage,
  useRequireHostRedirect,
} from "@/components/attendance-hq/host-management";
import { createEvent, duplicateEvent, getEventFormPayload } from "@/lib/attendance-hq.functions";
import { queryKeys } from "@/lib/query-keys";

function EventCreateError({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  return (
    <ManagementPageShell>
      <div className="ios-card mt-6 rounded-3xl p-6 text-center">
        <p className="text-sm text-destructive">{getManagementErrorMessage(error, "Unable to load event form.")}</p>
        <Button className="mt-4" variant="hero" onClick={() => { router.invalidate(); reset(); }}>Try again</Button>
      </div>
    </ManagementPageShell>
  );
}

function EventCreateNotFound() {
  return <ManagementPageShell><div className="py-16 text-center text-sm text-muted-foreground">Event setup could not be loaded.</div></ManagementPageShell>;
}

export const Route = createFileRoute("/events/new")({
  validateSearch: (search: Record<string, unknown>) => ({
    clubId: typeof search.clubId === "string" ? search.clubId : "",
    templateId: typeof search.templateId === "string" ? search.templateId : "",
    duplicateFrom: typeof search.duplicateFrom === "string" ? search.duplicateFrom : "",
  }),
  errorComponent: EventCreateError,
  notFoundComponent: EventCreateNotFound,
  head: () => ({
    meta: [
      { title: "Create Event — Attendance HQ" },
      { name: "description", content: "Create a new event from scratch, a template, or a duplicate." },
      { property: "og:title", content: "Create Event — Attendance HQ" },
      { property: "og:description", content: "Create a new event from scratch, a template, or a duplicate." },
      { name: "twitter:title", content: "Create Event — Attendance HQ" },
      { name: "twitter:description", content: "Create a new event from scratch, a template, or a duplicate." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: EventCreateRoute,
});

function EventCreateRoute() {
  const { loading, user } = useRequireHostRedirect();
  const navigate = useNavigate();
  const search = Route.useSearch();

  const payloadInput = { eventId: "", ...search };

  const payloadQuery = useAuthorizedQuery(
    queryKeys.events.formPayload(payloadInput),
    getEventFormPayload,
    payloadInput,
  );

  const createEventMutation = useAuthorizedMutation(createEvent, {
    invalidate: [queryKeys.events.all, queryKeys.clubs.all],
  });
  const duplicateEventMutation = useAuthorizedMutation(duplicateEvent, {
    invalidate: [queryKeys.events.all, queryKeys.clubs.all],
  });

  const payload = payloadQuery.data;

  // A host can hit /events/new from the mobile + button before they've created
  // their first club. Bounce them through onboarding instead of rendering an
  // event form with no club to attach to.
  useEffect(() => {
    if (payload && payload.clubs.length === 0) {
      navigate({ to: "/onboarding/club" });
    }
  }, [payload, navigate]);

  if (loading || !user || (payloadQuery.isLoading && !payload)) {
    return <ManagementPageShell hideTabBar><div className="py-16 text-center text-sm text-muted-foreground">Loading event form…</div></ManagementPageShell>;
  }

  if (payloadQuery.error) return <EventCreateError error={payloadQuery.error} reset={() => payloadQuery.refetch()} />;
  if (!payload || payload.clubs.length === 0) {
    return <ManagementPageShell hideTabBar><div className="py-16 text-center text-sm text-muted-foreground">Loading event form…</div></ManagementPageShell>;
  }

  return (
    <EventForm
      payload={payload}
      title={payload.sourceEventId ? "Duplicate Event" : "Create Event"}
      description={payload.sourceEventId ? "Adjust the details and create a fresh event with a new QR code." : "Create the next event for one of your clubs."}
      submitLabel={payload.sourceEventId ? "Create Duplicate" : "Create Event"}
      onSubmit={async (values) => {
        if (payload.sourceEventId) {
          const result = await duplicateEventMutation.mutateAsync({ ...values, sourceEventId: payload.sourceEventId } as never);
          navigate({ to: "/events/$eventId", params: { eventId: result.event.id }, search: { created: "1" } });
          return;
        }

        const result = await createEventMutation.mutateAsync(values as never);
        navigate({ to: "/events/$eventId", params: { eventId: result.event.id }, search: { created: "1" } });
      }}
    />
  );
}
