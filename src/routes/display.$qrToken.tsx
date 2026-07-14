import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Maximize2, Users } from "lucide-react";
import QRCode from "react-qr-code";
import { Button } from "@/components/ui/button";
import { getPublicEventDisplay } from "@/lib/attendance-hq.functions";
import {
  formatEventDate,
  formatEventTime,
  formatTimestamp,
  getCheckInStatus,
} from "@/lib/attendance-hq";

const POLL_INTERVAL_MS = 15_000;

function DisplayError({ error }: { error: Error }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-hero px-6 text-white">
      <div className="rounded-3xl bg-white/10 p-6 text-center text-sm">{error.message}</div>
    </div>
  );
}

function EventUnavailable({ reason }: { reason: "not_found" | "archived" }) {
  const message = reason === "archived"
    ? "This event has ended and is no longer accepting check-ins."
    : "This event could not be found. Ask the host for an updated link.";
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-hero px-6 text-white">
      <div className="max-w-md rounded-3xl bg-white/10 p-8 text-center backdrop-blur-md ring-1 ring-white/15">
        <p className="font-display text-[24px] font-black">Event unavailable</p>
        <p className="mt-2 text-[14px] text-white/80">{message}</p>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/display/$qrToken")({
  errorComponent: DisplayError,
  head: () => ({
    meta: [
      { title: "Event check-in — Attendance HQ" },
      { name: "description", content: "Scan the QR to check in to this event." },
      { property: "og:title", content: "Event check-in — Attendance HQ" },
      { property: "og:description", content: "Scan the QR to check in to this event." },
      { name: "twitter:title", content: "Event check-in — Attendance HQ" },
      { name: "twitter:description", content: "Scan the QR to check in to this event." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: PublicDisplayRoute,
});

function PublicDisplayRoute() {
  const { qrToken } = Route.useParams();
  const [now, setNow] = useState(() => new Date());

  const displayQuery = useQuery({
    queryKey: ["public-display", qrToken] as const,
    queryFn: () => getPublicEventDisplay({ data: { qrToken } }),
    refetchInterval: POLL_INTERVAL_MS,
    refetchIntervalInBackground: true,
    staleTime: 0,
  });

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const checkInUrl = useMemo(() => {
    return typeof window === "undefined"
      ? `/check-in/${qrToken}`
      : `${window.location.origin}/check-in/${qrToken}`;
  }, [qrToken]);

  const handleFullscreen = async () => {
    if (typeof document === "undefined") return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      return;
    }
  };

  if (displayQuery.isLoading && !displayQuery.data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-hero text-white/80">
        Loading…
      </div>
    );
  }

  if (displayQuery.error && !displayQuery.data) return <DisplayError error={displayQuery.error as Error} />;
  const payload = displayQuery.data;
  if (!payload) return null;
  if (!payload.ok) return <EventUnavailable reason={payload.reason} />;

  const { event, attendanceCount, recent15m } = payload;
  const status = getCheckInStatus({
    check_in_opens_at: event.check_in_opens_at,
    check_in_closes_at: event.check_in_closes_at,
    is_active: event.is_active,
    is_archived: event.is_archived,
  } as never);

  const statusCopy = status === "open"
    ? `Check-in open until ${formatTimestamp(event.check_in_closes_at)}`
    : status === "upcoming"
      ? `Check-in opens at ${formatTimestamp(event.check_in_opens_at)}`
      : status === "archived"
        ? "This event is archived"
        : status === "inactive"
          ? "This event was closed early"
          : `Check-in closed at ${formatTimestamp(event.check_in_closes_at)}`;

  const timeString = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  return (
    <div className="relative min-h-screen overflow-hidden hero-wash text-white">
      <div className="blur-orb-white -left-24 -top-24 h-[36rem] w-[36rem] opacity-25" />
      <div className="blur-orb-gold -bottom-32 -right-24 h-[40rem] w-[40rem] opacity-35" />

      <div className="relative z-10 flex items-center justify-between px-8 pt-6">
        <div className="flex items-center gap-3 text-[13px] font-medium text-white/85">
          <span className={`inline-flex h-2 w-2 rounded-full ${status === "open" ? "bg-success" : "bg-white/60"}`} />
          <span className="uppercase tracking-[0.18em]">{status === "open" ? "Live" : status}</span>
          <span className="text-white/50">·</span>
          <span>{timeString}</span>
        </div>
        <Button variant="ghost" size="sm" className="rounded-full text-white/85 hover:bg-white/10 hover:text-white" onClick={() => void handleFullscreen()}>
          <Maximize2 className="h-4 w-4" /> Fullscreen
        </Button>
      </div>

      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-6rem)] w-full max-w-[1600px] flex-col items-center justify-center px-8 py-6">
        <div className="grid w-full grid-cols-1 items-center gap-10 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-16">
          <div className="text-center lg:text-left">
            <p className="font-display text-[clamp(14px,1.4vw,20px)] font-semibold uppercase tracking-[0.28em] text-white/70">
              {event.club_name}
            </p>
            <h1 className="mt-4 font-display text-[clamp(44px,7vw,120px)] font-black leading-[0.95] tracking-tight">
              {event.event_name}
            </h1>
            <p className="mt-5 font-display text-[clamp(18px,2vw,32px)] font-semibold text-white/90">
              {formatEventDate(event.event_date)} · {formatEventTime(event.start_time, event.end_time)}
            </p>
            <p className="mt-3 text-[clamp(14px,1.3vw,20px)] text-white/70">{statusCopy}</p>

            <div className="mt-10 inline-flex items-end gap-6 rounded-3xl bg-white/10 px-8 py-6 backdrop-blur-md ring-1 ring-white/15">
              <div>
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/70">
                  <Users className="h-3.5 w-3.5" /> Checked in
                </div>
                <p className="mt-1 font-display text-[clamp(64px,10vw,160px)] font-black leading-none tabular-nums">
                  {attendanceCount}
                </p>
              </div>
              <div className="pb-3 text-left">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/70">Last 15 min</p>
                <p className="mt-1 font-display text-[clamp(24px,3vw,44px)] font-black leading-none tabular-nums text-accent">
                  +{recent15m}
                </p>
              </div>
            </div>
          </div>

          <div className="mx-auto w-full max-w-[min(46vw,42rem)] lg:mx-0">
            <div className="rounded-[2.5rem] bg-white p-[clamp(16px,2vw,32px)] shadow-[0_50px_120px_-30px_rgba(0,0,0,0.55)]">
              <QRCode value={checkInUrl} size={1024} className="h-auto w-full" level="H" />
            </div>
            <p className="mt-6 text-center font-display text-[clamp(20px,2.2vw,36px)] font-extrabold tracking-tight">
              Scan to check in
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
