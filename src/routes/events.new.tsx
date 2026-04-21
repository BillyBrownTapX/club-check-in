import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAuthorizedServerFn } from "@/components/attendance-hq/auth-provider";
import { EventForm, ManagementPageShell, useRequireHostRedirect } from "@/components/attendance-hq/host-management";
import { createEvent, duplicateEvent, getEventFormPayload } from "@/lib/attendance-hq.functions";
import type { EventFormPayload } from "@/lib/attendance-hq";

function EventCreateError({ error }: { error: Error }) {
  return <ManagementPageShell><div className="py-16 text-center text-sm text-muted-foreground">{error.message}</div></ManagementPageShell>;
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
    ],
  }),
  component: EventCreateRoute,
});

function EventCreateRoute() {
  const { loading, user } = useRequireHostRedirect();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const loadPayload = useAuthorizedServerFn(getEventFormPayload);
  const createEventMutation = useAuthorizedServerFn(createEvent);
  const duplicateEventMutation = useAuthorizedServerFn(duplicateEvent);
  const [payload, setPayload] = useState<EventFormPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading || !user) return;
    let cancelled = false;

    void loadPayload({ data: search })
      .then((nextPayload) => {
        if (!cancelled) setPayload(nextPayload);
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Unable to load event form.");
      });

    return () => {
      cancelled = true;
    };
  }, [loadPayload, loading, search, user]);

  if (loading || !user || !payload) {
    return <ManagementPageShell><div className="py-16 text-center text-sm text-muted-foreground">Loading event form…</div></ManagementPageShell>;
  }

  if (error) return <EventCreateError error={new Error(error)} />;

  return (
    <EventForm
      payload={payload}
      title={payload.sourceEventId ? "Duplicate Event" : "Create Event"}
      description={payload.sourceEventId ? "Adjust the details and create a fresh event with a new QR code." : "Create the next event for one of your clubs."}
      submitLabel={payload.sourceEventId ? "Create Duplicate" : "Create Event"}
      onSubmit={async (values) => {
        if (payload.sourceEventId) {
          const result = await duplicateEventMutation({ data: { ...values, sourceEventId: payload.sourceEventId } });
          navigate({ to: "/events/$eventId", params: { eventId: result.event.id }, search: { created: "1" } });
          return;
        }

        const result = await createEventMutation({ data: values });
        navigate({ to: "/events/$eventId", params: { eventId: result.event.id }, search: { created: "1" } });
      }}
    />
  );
}