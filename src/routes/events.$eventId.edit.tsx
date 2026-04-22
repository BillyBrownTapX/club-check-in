import { Link, createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuthorizedMutation, useAuthorizedQuery } from "@/components/attendance-hq/auth-provider";
import { Button } from "@/components/ui/button";
import {
  DeleteConfirmButton,
  EventForm,
  ManagementPageShell,
  SecondaryButton,
  getManagementErrorMessage,
  useRequireHostRedirect,
} from "@/components/attendance-hq/host-management";
import { deleteEvent, getEventFormPayload, updateEvent } from "@/lib/attendance-hq.functions";
import { queryKeys } from "@/lib/query-keys";

function EventEditError({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  return (
    <ManagementPageShell>
      <div className="ios-card mt-6 rounded-3xl p-6 text-center">
        <p className="text-sm text-destructive">{getManagementErrorMessage(error, "Unable to load event.")}</p>
        <Button className="mt-4" variant="hero" onClick={() => { router.invalidate(); reset(); }}>Try again</Button>
      </div>
    </ManagementPageShell>
  );
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
      { property: "og:title", content: "Edit Event — Attendance HQ" },
      { property: "og:description", content: "Update event details without changing the existing QR code." },
      { name: "twitter:title", content: "Edit Event — Attendance HQ" },
      { name: "twitter:description", content: "Update event details without changing the existing QR code." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: EventEditRoute,
});

function EventEditRoute() {
  const { loading, user } = useRequireHostRedirect();
  const { eventId } = Route.useParams();
  const navigate = useNavigate();

  const payloadInput = { eventId, clubId: "", templateId: "", duplicateFrom: "" };

  const payloadQuery = useAuthorizedQuery(
    queryKeys.events.formPayload(payloadInput),
    getEventFormPayload,
    payloadInput,
  );

  const updateEventMutation = useAuthorizedMutation(updateEvent, {
    invalidate: [queryKeys.events.all, queryKeys.events.detail(eventId), queryKeys.clubs.all],
  });
  const deleteEventMutation = useAuthorizedMutation(deleteEvent, {
    invalidate: [queryKeys.events.all, queryKeys.clubs.all],
  });

  const payload = payloadQuery.data;

  if (loading || !user || (payloadQuery.isLoading && !payload)) {
    return <ManagementPageShell hideTabBar><div className="py-16 text-center text-sm text-muted-foreground">Loading event…</div></ManagementPageShell>;
  }

  if (payloadQuery.error) return <EventEditError error={payloadQuery.error} reset={() => payloadQuery.refetch()} />;
  if (!payload) {
    return <ManagementPageShell hideTabBar><div className="py-16 text-center text-sm text-muted-foreground">Loading event…</div></ManagementPageShell>;
  }

  return (
    <EventForm
      payload={payload}
      title="Edit Event"
      description="Update the event details while keeping the current QR code active."
      submitLabel="Save Changes"
      cancelAction={
        <div className="flex flex-wrap gap-2">
          <SecondaryButton asChild>
            <Link to="/events/$eventId" params={{ eventId }} search={{ created: "" }}>Cancel</Link>
          </SecondaryButton>
          <DeleteConfirmButton
            trigger={
              <Button
                type="button"
                variant="outline"
                className="h-12 rounded-xl border-destructive/30 px-5 text-sm font-semibold text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
                Delete Event
              </Button>
            }
            title="Delete this event?"
            description="This permanently removes the event, its attendance records, and action history. This cannot be undone."
            onConfirm={async () => {
              await deleteEventMutation.mutateAsync({ eventId } as never);
              toast.success("Event deleted");
              navigate({ to: "/events", search: { clubId: "", status: "all", query: "" } });
            }}
          />
        </div>
      }
      onSubmit={async (values) => {
        const result = await updateEventMutation.mutateAsync({ ...values, eventId } as never);
        navigate({ to: "/events/$eventId", params: { eventId: result.id }, search: { created: "" } });
      }}
    />
  );
}
