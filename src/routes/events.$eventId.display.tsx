import { useMemo } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Maximize2, Users } from "lucide-react";
import QRCode from "react-qr-code";
import { Button } from "@/components/ui/button";
import { useAuthorizedQuery } from "@/components/attendance-hq/auth-provider";
import { useRequireHostRedirect } from "@/components/attendance-hq/host-management";
import { Chip } from "@/components/attendance-hq/ios";
import { getEventDisplayPayload } from "@/lib/attendance-hq.functions";
import {
  formatEventDate,
  formatEventTime,
  formatTimestamp,
  getCheckInStatus,
  type EventWithClub,
} from "@/lib/attendance-hq";
import { useEventRealtime } from "@/hooks/use-event-realtime";
import { queryKeys } from "@/lib/query-keys";

const DISPLAY_FALLBACK_POLL_INTERVAL_MS = 30_000;

function DisplayError({ error }: { error: Error }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-hero px-6">
      <div className="ios-card rounded-3xl p-6 text-center text-sm text-muted-foreground">{error.message}</div>
    </div>
  );
}

function DisplayNotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-hero px-6">
      <div className="ios-card rounded-3xl p-6 text-center text-sm text-muted-foreground">Event not found.</div>
    </div>
  );
}

export const Route = createFileRoute("/events/$eventId/display")({
  errorComponent: DisplayError,
  notFoundComponent: DisplayNotFound,
  head: () => ({
    meta: [
      { title: "QR display — Attendance HQ" },
      { name: "description", content: "Wallet-style QR display for an Attendance HQ event." },
      { property: "og:title", content: "QR display — Attendance HQ" },
      { property: "og:description", content: "Wallet-style QR display for an Attendance HQ event." },
      { name: "twitter:title", content: "QR display — Attendance HQ" },
      { name: "twitter:description", content: "Wallet-style QR display for an Attendance HQ event." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: EventDisplayRoute,
});

function EventDisplayRoute() {
  const { loading, user } = useRequireHostRedirect();
  const { eventId } = Route.useParams();
  const queryClient = useQueryClient();

  const displayQuery = useAuthorizedQuery(
    queryKeys.events.display(eventId),
    getEventDisplayPayload,
    { eventId },
    { staleTime: 0 }, // realtime-driven; never serve stale
  );

  // Realtime → invalidate the cache. Query dedupes parallel invalidations,
  // so a burst of inserts coalesces into one network request.
  const { status: realtimeStatus, hasEverConnected: realtimeEverConnected } = useEventRealtime({
    eventId,
    enabled: !!displayQuery.data,
    onChange: () => { void queryClient.invalidateQueries({ queryKey: queryKeys.events.display(eventId) }); },
    fallbackPollMs: DISPLAY_FALLBACK_POLL_INTERVAL_MS,
  });
  const realtimeReconnecting = realtimeEverConnected && realtimeStatus !== "connected" && realtimeStatus !== "idle";

  const event = (displayQuery.data?.event ?? null) as EventWithClub | null;
  const attendanceCount = displayQuery.data?.attendanceCount ?? 0;
  const summary = displayQuery.data?.summary ?? null;
  const lastUpdatedAt = displayQuery.dataUpdatedAt ? new Date(displayQuery.dataUpdatedAt).toISOString() : null;

  const checkInUrl = useMemo(() => {
    if (!event) return "";
    return typeof window === "undefined"
      ? `/check-in/${event.qr_token}`
      : `${window.location.origin}/check-in/${event.qr_token}`;
  }, [event]);

  const handleEnterFullscreen = async () => {
    if (typeof document === "undefined") return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      return;
    }
  };

  if (loading || !user || (displayQuery.isLoading && !event)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-hero text-sm text-white/80">
        Loading…
      </div>
    );
  }

  if (displayQuery.error && !event) return <DisplayError error={displayQuery.error} />;
  if (!event) return <DisplayNotFound />;

  const status = getCheckInStatus(event);
  const statusCopy = status === "open"
    ? `Open until ${formatTimestamp(event.check_in_closes_at)}`
    : status === "upcoming"
      ? `Opens at ${formatTimestamp(event.check_in_opens_at)}`
      : status === "archived"
        ? "This event is archived"
        : status === "inactive"
          ? "This event was closed early"
          : `Closed at ${formatTimestamp(event.check_in_closes_at)}`;

  return (
    <div className="relative min-h-screen overflow-hidden hero-wash">
      <div className="blur-orb-white -left-20 top-10 h-64 w-64 opacity-30" />
      <div className="blur-orb-gold -bottom-20 -right-12 h-72 w-72 opacity-40" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-[440px] flex-col px-4 pb-safe pt-safe-1 sm:max-w-[480px] sm:px-5">
        <div className="flex items-center justify-between py-3">
          <Button asChild variant="ghost" size="icon" className="rounded-full text-white hover:bg-white/15 hover:text-white">
            <Link to="/events/$eventId" params={{ eventId }} search={{ created: "" }}>
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <Chip tone="gold" className="border-white/30 bg-white/15 text-white">
            <span
              className={`inline-flex h-1.5 w-1.5 rounded-full ${realtimeReconnecting ? "bg-warning animate-pulse" : "bg-success"}`}
            />
            {realtimeReconnecting ? "Reconnecting" : status === "open" ? "Live" : status}
          </Chip>
          <Button variant="ghost" size="icon" className="rounded-full text-white hover:bg-white/15 hover:text-white" onClick={() => void handleEnterFullscreen()}>
            <Maximize2 className="h-5 w-5" />
          </Button>
        </div>

        {/* Wallet-style pass card */}
        <div className="mt-4 flex flex-1 flex-col items-center justify-start">
          <div className="w-full overflow-hidden rounded-[2rem] bg-white shadow-[0_30px_70px_-20px_rgba(15,23,42,0.45)] ios-spring-in">
            <div className="bg-gradient-brand px-5 py-5 text-white">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/80">{event.clubs?.club_name ?? "Club event"}</p>
              <h1 className="mt-2 font-display text-[26px] font-extrabold leading-tight">{event.event_name}</h1>
              <p className="mt-2 text-[13px] text-white/85">{formatEventDate(event.event_date)} · {formatEventTime(event.start_time, event.end_time)}</p>
            </div>
            <div className="relative">
              {/* perforation */}
              <div className="absolute -left-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-[hsl(var(--app-shell))]" />
              <div className="absolute -right-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-[hsl(var(--app-shell))]" />
              <div className="border-y border-dashed border-border" />
            </div>
            <div className="flex items-center justify-center px-6 py-7">
              {checkInUrl ? <QRCode value={checkInUrl} size={272} className="h-auto w-full max-w-[280px]" /> : null}
            </div>
            <div className="px-5 pb-5 text-center">
              <p className="text-[12px] text-muted-foreground">{statusCopy}</p>
              <p className="mt-3 break-all text-[11.5px] text-muted-foreground/80">{checkInUrl}</p>
            </div>
          </div>

          {/* Live counter */}
          <div className="mt-4 grid w-full grid-cols-2 gap-3">
            <div className="ios-glass rounded-2xl p-4 text-white">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-white/80">
                <Users className="h-3.5 w-3.5" /> Checked in
              </div>
              <p className="mt-2 font-display text-[34px] font-black leading-none">{attendanceCount}</p>
            </div>
            <div className="ios-glass rounded-2xl p-4 text-white">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-white/80">Recent (15m)</p>
              <p className="mt-2 font-display text-[34px] font-black leading-none">{summary?.recent ?? 0}</p>
            </div>
          </div>
          <p className="mt-3 text-[11px] text-white/70">Updated {lastUpdatedAt ? formatTimestamp(lastUpdatedAt) : "—"}</p>
        </div>
      </div>
    </div>
  );
}
