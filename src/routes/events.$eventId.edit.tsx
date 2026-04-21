import { useEffect, useState } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAuthorizedServerFn } from "@/components/attendance-hq/auth-provider";
import { EventForm, ManagementPageShell, SecondaryButton, getManagementErrorMessage, useRequireHostRedirect } from "@/components/attendance-hq/host-management";
import { getEventFormPayload, updateEvent } from "@/lib/attendance-hq.functions";
import type { EventFormPayload } from "@/lib/attendance-hq";

function EventEditError({ error }: { error: Error }) {
  return <ManagementPageShell><div className="py-16 text-center text-sm text-muted-foreground">{error.message}</div></ManagementPageShell>;
}

function EventEditNotFound() {
  return <ManagementPageShell><div className="py-16 text-center text-sm text-muted-foreground">Event not found.</div></ManagementPageShell>;
}

export const Route = createFileRoute("/events/$eventId/edit")({
  errorComponent: EventEditError,
  notFoundComponent: EventEditNotFound,
  head: () => ({
    meta: [
      { title: "Edit Event — Attendance HQ" },
      { name: "description", content: "Update event details without changing the existing QR code." },
    ],
  }),
  component: EventEditRoute,
});

function EventEditRoute() {
  const { loading, user } = useRequireHostRedirect();
  const { eventId } = Route.useParams();
  const navigate = useNavigate();
  const loadPayload = useAuthorizedServerFn(getEventFormPayload);
  const updateEventMutation = useAuthorizedServerFn(updateEvent);
  const [payload, setPayload] = useState<EventFormPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading || !user) return;
    let cancelled = false;

    void loadPayload({ data: { eventId } })
      .then((nextPayload) => {
        if (!cancelled) setPayload(nextPayload);
      })
      .catch((loadError) => {
        if (!cancelled) setError(getManagementErrorMessage(loadError, "Unable to load event."));
      });

    return () => {
      cancelled = true;
    };
  }, [eventId, loadPayload, loading, user]);

  if (loading || !user || !payload) {
    return <ManagementPageShell><div className="py-16 text-center text-sm text-muted-foreground">Loading event…</div></ManagementPageShell>;
  }

  if (error) return <EventEditError error={new Error(error)} />;

  return (
    <EventForm
      payload={payload}
      title="Edit Event"
      description="Update the event details while keeping the current QR code active."
      submitLabel="Save Changes"
      cancelAction={<SecondaryButton asChild><Link to="/events/$eventId" params={{ eventId }}>Cancel</Link></SecondaryButton>}
      onSubmit={async (values) => {
        const result = await updateEventMutation({ data: { ...values, eventId } });
        navigate({ to: "/events/$eventId", params: { eventId: result.id } });
      }}
    />
  );
}