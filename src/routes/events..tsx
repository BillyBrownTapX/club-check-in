import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { EventReadyCard } from "@/components/attendance-hq/host-onboarding";
import { useAttendanceAuth } from "@/components/attendance-hq/auth-provider";
import type { AttendanceRow, EventWithClub } from "@/lib/attendance-hq";
import { getHostEventDetail } from "@/lib/host-onboarding-client";

export const Route = createFileRoute("/events/")({
  validateSearch: (search: Record<string, unknown>) => ({
    created: typeof search.created === "string" ? search.created : "",
  }),
  head: () => ({
    meta: [
      { title: "Event setup — Attendance HQ" },
      { name: "description", content: "Manage your QR-ready event and monitor attendance in Attendance HQ." },
    ],
  }),
  component: EventDetailRoute,
});

function EventDetailRoute() {
  const navigate = useNavigate();
  const { user, loading } = useAttendanceAuth();
  const { eventId } = Route.useParams();
  const search = Route.useSearch();
  const [event, setEvent] = useState<EventWithClub | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const successMessage = useMemo(() => search.created === "1" ? "Your event is ready. Open the QR code to start check-in." : "", [search.created]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/sign-in" });
      return;
    }

    void getHostEventDetail(eventId, user.id)
      .then((detail) => {
        if (!detail) {
          setError("We couldn’t find that event.");
          return;
        }
        setEvent(detail.event);
        setAttendance(detail.attendance);
      })
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Unable to load event."));
  }, [eventId, loading, navigate, user]);

  if (loading || !user) return null;
  if (error) return <div className="flex min-h-screen items-center justify-center px-4 text-center text-sm text-muted-foreground">{error}</div>;
  if (!event) return <div className="flex min-h-screen items-center justify-center px-4 text-center text-sm text-muted-foreground">Loading your event…</div>;

  return (
    <EventReadyCard
      event={event}
      attendance={attendance}
      successMessage={successMessage || undefined}
      onCopyLink={() => {
        const url = `${window.location.origin}/check-in/${event.qr_token}`;
        void navigator.clipboard.writeText(url);
      }}
    />
  );
}
