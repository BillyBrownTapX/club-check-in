import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, Maximize2, Users } from "lucide-react";
import QRCode from "react-qr-code";
import { Button } from "@/components/ui/button";
import { useAuthorizedServerFn } from "@/components/attendance-hq/auth-provider";
import { useRequireHostRedirect } from "@/components/attendance-hq/host-management";
import { getEventDisplayPayload } from "@/lib/attendance-hq.functions";
import {
  formatEventDate,
  formatEventTime,
  formatTimestamp,
  getCheckInStatus,
  type EventDisplayPayload,
  type EventAttendanceSummary,
  type EventWithClub,
} from "@/lib/attendance-hq";

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
  const loadDisplayPayload = useAuthorizedServerFn(getEventDisplayPayload);

  const [event, setEvent] = useState<EventWithClub | null>(null);
  const [attendanceCount, setAttendanceCount] = useState(0);
  const [summary, setSummary] = useState<EventAttendanceSummary | null>(null);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const next = await loadDisplayPayload({ data: { eventId } }) as EventDisplayPayload;
      setEvent(next.event as EventWithClub);
      setAttendanceCount(next.attendanceCount);
      setSummary(next.summary);
      setLastUpdatedAt(new Date().toISOString());
      setLoadError(null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Unable to load event.");
    }
  }, [eventId, loadDisplayPayload]);

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
      return;
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

  const status = getCheckInStatus(event);
  const statusCopy = status === "open"
    ? `Check-in is open until ${formatTimestamp(event.check_in_closes_at)}`
    : status === "upcoming"
      ? `Check-in opens at ${formatTimestamp(event.check_in_opens_at)}`
      : status === "archived"
        ? "This event is archived"
        : status === "inactive"
          ? "This event was closed early"
          : `Check-in closed at ${formatTimestamp(event.check_in_closes_at)}`;

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

      <div className="space-y-3 text-center">
        <p className="text-base font-semibold uppercase tracking-[0.18em] text-muted-foreground sm:text-lg">
          {event.clubs?.club_name ?? "Club event"}
        </p>
        <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-6xl">{event.event_name}</h1>
        <p className="text-lg text-muted-foreground sm:text-xl">
          {formatEventDate(event.event_date)} · {formatEventTime(event.start_time, event.end_time)}
        </p>
        <p className="text-sm text-muted-foreground sm:text-base">{statusCopy}</p>
      </div>

      <div className="grid w-full max-w-6xl gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-center">
        <div className="flex items-center justify-center rounded-[2rem] bg-white p-6 shadow-lg sm:p-8">
          {checkInUrl ? <QRCode value={checkInUrl} size={420} className="h-auto w-full max-w-[28rem]" /> : null}
        </div>
        <div className="space-y-4">
          <div className="rounded-[2rem] border border-border/70 bg-card px-6 py-8 text-center shadow-sm">
            <div className="inline-flex items-center gap-3 text-muted-foreground">
              <Users className="h-5 w-5" />
              <span className="text-sm font-medium uppercase tracking-[0.18em]">Checked in</span>
            </div>
            <div className="mt-4 text-7xl font-bold leading-none text-foreground">{attendanceCount}</div>
            <p className="mt-3 text-sm text-muted-foreground">{summary?.recent ?? 0} in the last 15 minutes</p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-card px-5 py-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Last updated</p>
            <p className="mt-2 text-lg font-semibold text-foreground">{lastUpdatedAt ? formatTimestamp(lastUpdatedAt) : "—"}</p>
            <p className="mt-1 text-sm text-muted-foreground">Polling every {DISPLAY_POLL_INTERVAL_MS / 1000}s while this screen is visible.</p>
          </div>
        </div>
      </div>

      <div className="flex max-w-4xl flex-col items-center gap-2">
        <p className="max-w-2xl break-all text-center text-sm text-muted-foreground sm:text-base">
          {checkInUrl}
        </p>
      </div>
    </div>
  );
}
