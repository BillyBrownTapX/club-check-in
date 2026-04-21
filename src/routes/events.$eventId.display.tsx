import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, Maximize2, Users } from "lucide-react";
import QRCode from "react-qr-code";
import { Button } from "@/components/ui/button";
import { useAuthorizedServerFn } from "@/components/attendance-hq/auth-provider";
import { useRequireHostRedirect } from "@/components/attendance-hq/host-management";
import { getEventOperations } from "@/lib/attendance-hq.functions";
import {
  formatEventDate,
  formatEventTime,
  type AttendanceRow,
  type EventWithClub,
} from "@/lib/attendance-hq";

// Faster polling than the ops console: this view is meant to be projected
// in the room, so the live count needs to feel near-instant.
const DISPLAY_POLL_INTERVAL_MS = 3000;

function DisplayError({ error }: { error: Error }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 text-center text-sm text-muted-foreground">
      {error.message}
    </div>
  );
}

function DisplayNotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 text-center text-sm text-muted-foreground">
      Event not found.
    </div>
  );
}

export const Route = createFileRoute("/events/$eventId/display")({
  errorComponent: DisplayError,
  notFoundComponent: DisplayNotFound,
  head: () => ({
    meta: [
      { title: "QR display — Attendance HQ" },
      { name: "description", content: "Full-screen QR code projector for an Attendance HQ event." },
    ],
  }),
  component: EventDisplayRoute,
});

function EventDisplayRoute() {
  const { loading, user } = useRequireHostRedirect();
  const { eventId } = Route.useParams();
  const loadOperations = useAuthorizedServerFn(getEventOperations);

  const [event, setEvent] = useState<EventWithClub | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const next = await loadOperations({ data: { eventId } });
      setEvent(next.event as EventWithClub);
      setAttendance(next.attendance);
      setLoadError(null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Unable to load event.");
    }
  }, [eventId, loadOperations]);

  useEffect(() => {
    if (loading || !user) return;
    let cancelled = false;
    void (async () => {
      await refresh();
      if (!cancelled) setInitialLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [loading, refresh, user]);

  useEffect(() => {
    if (!initialLoaded) return;
    const id = window.setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      void refresh();
    }, DISPLAY_POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [initialLoaded, refresh]);

  const checkInUrl = useMemo(() => {
    if (!event) return "";
    return typeof window === "undefined"
      ? `/check-in/${event.qr_token}`
      : `${window.location.origin}/check-in/${event.qr_token}`;
  }, [event]);

  const handleEnterFullscreen = async () => {
    if (typeof document === "undefined") return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      // Some browsers reject without a user gesture or in iframes — silent
      // fallback is fine, the page is already laid out for projection.
    }
  };

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (!initialLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Loading event…
      </div>
    );
  }

  if (loadError && !event) return <DisplayError error={new Error(loadError)} />;
  if (!event) return <DisplayNotFound />;

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center gap-8 bg-background px-6 py-10 sm:py-16">
      <div className="absolute left-4 top-4 flex gap-2">
        <Button asChild variant="ghost" className="rounded-xl">
          <Link to="/events/$eventId" params={{ eventId }} search={{ created: "" }}>
            <ArrowLeft className="h-4 w-4" />Back
          </Link>
        </Button>
      </div>
      <div className="absolute right-4 top-4">
        <Button type="button" variant="ghost" className="rounded-xl" onClick={() => void handleEnterFullscreen()}>
          <Maximize2 className="h-4 w-4" />Fullscreen
        </Button>
      </div>

      <div className="space-y-2 text-center">
        <p className="text-base font-semibold uppercase tracking-[0.18em] text-muted-foreground sm:text-lg">
          {event.clubs?.club_name ?? "Club event"}
        </p>
        <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-6xl">{event.event_name}</h1>
        <p className="text-lg text-muted-foreground sm:text-xl">
          {formatEventDate(event.event_date)} · {formatEventTime(event.start_time, event.end_time)}
        </p>
      </div>

      <div className="rounded-3xl bg-white p-6 shadow-lg">
        {checkInUrl ? <QRCode value={checkInUrl} size={384} className="h-auto w-[18rem] sm:w-[24rem] lg:w-[28rem]" /> : null}
      </div>

      <div className="flex flex-col items-center gap-2">
        <div className="inline-flex items-center gap-2 rounded-2xl bg-secondary px-5 py-3 text-2xl font-semibold text-foreground sm:text-3xl">
          <Users className="h-6 w-6" />
          {attendance.length} checked in
        </div>
        <p className="max-w-2xl break-all text-center text-sm text-muted-foreground sm:text-base">
          {checkInUrl}
        </p>
      </div>
    </div>
  );
}
