import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  AlertCircle,
  CalendarDays,
  Clock3,
  Copy,
  Download,
  ExternalLink,
  MapPin,
  Maximize2,
  Pencil,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import QRCode from "react-qr-code";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuthorizedServerFn } from "@/components/attendance-hq/auth-provider";
import {
  ManagementPageShell,
  PageHeader,
  PrimaryButton,
  SecondaryButton,
  StatsCard,
  getManagementErrorMessage,
  useRequireHostRedirect,
} from "@/components/attendance-hq/host-management";
import {
  closeCheckInEarly,
  duplicateEvent,
  exportEventAttendance,
  getEventOperations,
  removeAttendance,
} from "@/lib/attendance-hq.functions";
import {
  formatEventDate,
  formatEventTime,
  formatTimestamp,
  getCheckInStatus,
  type AttendanceRow,
  type EventWithClub,
} from "@/lib/attendance-hq";

// How often the ops console re-fetches attendance + event metadata while the
// page is mounted. 5s is responsive enough for a check-in dashboard without
// abusing the server fn endpoint. We pause polling while the tab is hidden.
const POLL_INTERVAL_MS = 5000;

// Friendly labels for the public-flow method enum the server records on each
// attendance row. Anything else (legacy / future) falls back to a neutral
// "Manual" badge so the row still renders cleanly.
const METHOD_LABEL: Record<string, string> = {
  qr_scan: "First scan",
  returning_lookup: "Returning",
  remembered_device: "Remembered",
};

function EventDetailHardError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <ManagementPageShell>
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
        <div className="rounded-full bg-destructive/10 p-3 text-destructive">
          <AlertCircle className="h-6 w-6" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-foreground">Unable to load this event</h2>
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>
        {onRetry ? (
          <PrimaryButton type="button" onClick={onRetry}>
            <RefreshCw className="h-4 w-4" />Try again
          </PrimaryButton>
        ) : null}
      </div>
    </ManagementPageShell>
  );
}

function EventDetailNotFound() {
  return (
    <ManagementPageShell>
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-foreground">Event not found</h2>
          <p className="text-sm text-muted-foreground">It may have been deleted, archived, or you don't have access.</p>
        </div>
        <SecondaryButton asChild>
          <Link to="/events" search={{ clubId: "", status: "all", query: "" }}>Back to events</Link>
        </SecondaryButton>
      </div>
    </ManagementPageShell>
  );
}

export const Route = createFileRoute("/events/$eventId")({
  validateSearch: (search: Record<string, unknown>) => ({
    created: typeof search.created === "string" ? search.created : "",
  }),
  errorComponent: ({ error }: { error: Error }) => <EventDetailHardError message={error.message} />,
  notFoundComponent: EventDetailNotFound,
  head: () => ({
    meta: [
      { title: "Event ops — Attendance HQ" },
      { name: "description", content: "Live attendance monitoring and host actions for an Attendance HQ event." },
    ],
  }),
  component: EventDetailRoute,
});

function EventDetailRoute() {
  const { loading, user } = useRequireHostRedirect();
  const { eventId } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate();

  const loadOperations = useAuthorizedServerFn(getEventOperations);
  const removeAttendanceMutation = useAuthorizedServerFn(removeAttendance);
  const closeEarlyMutation = useAuthorizedServerFn(closeCheckInEarly);
  const duplicateEventMutation = useAuthorizedServerFn(duplicateEvent);
  const exportAttendanceFn = useAuthorizedServerFn(exportEventAttendance);

  const [event, setEvent] = useState<EventWithClub | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [hardError, setHardError] = useState<string | null>(null);
  const [softError, setSoftError] = useState<string | null>(null);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [closeEarlyOpen, setCloseEarlyOpen] = useState(false);
  const [closingEarly, setClosingEarly] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [lastRefreshAt, setLastRefreshAt] = useState<Date | null>(null);

  const createdToastFired = useRef(false);
  // Dedupe overlapping fetches. The polling tick and a manual refresh button
  // can race; we only ever want one in-flight fetch and we always honour the
  // most recent one's payload.
  const inFlightRef = useRef<Promise<void> | null>(null);

  // ?created=1 toast — fired once on mount, then the search param is cleared
  // so a refresh doesn't re-toast.
  useEffect(() => {
    if (search.created !== "1" || createdToastFired.current) return;
    createdToastFired.current = true;
    toast.success("Event created. Open the QR code to start check-in.");
    navigate({ to: "/events/$eventId", params: { eventId }, search: { created: "" }, replace: true });
  }, [eventId, navigate, search.created]);

  const refresh = useCallback(async () => {
    if (inFlightRef.current) return inFlightRef.current;
    const run = (async () => {
      try {
        const next = await loadOperations({ data: { eventId } });
        setEvent(next.event as EventWithClub);
        setAttendance(next.attendance);
        setSoftError(null);
        setHardError(null);
        setLastRefreshAt(new Date());
      } catch (error) {
        const message = getManagementErrorMessage(error, "Unable to load event.");
        // First load failure becomes a full-page error so the host sees it.
        // Subsequent failures (we already have data) become a soft banner so
        // the host can keep operating instead of staring at a blank page.
        if (!event) {
          setHardError(message);
        } else {
          setSoftError(message);
        }
      } finally {
        inFlightRef.current = null;
      }
    })();
    inFlightRef.current = run;
    return run;
  }, [event, eventId, loadOperations]);

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
    // We intentionally do not depend on `refresh` (which closes over `event`)
    // here — that would re-run the initial load on every successful fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user, eventId]);

  // Poll while the tab is visible. Pausing on hidden tabs saves a lot of
  // wasted requests when a host leaves the page open in a background tab.
  useEffect(() => {
    if (!initialLoaded) return;
    const id = window.setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      void refresh();
    }, POLL_INTERVAL_MS);
    return () => {
      window.clearInterval(id);
    };
  }, [initialLoaded, refresh]);

  const checkInUrl = useMemo(() => {
    if (!event) return "";
    return typeof window === "undefined"
      ? `/check-in/${event.qr_token}`
      : `${window.location.origin}/check-in/${event.qr_token}`;
  }, [event]);

  if (loading || !user) {
    return (
      <ManagementPageShell>
        <div className="py-16 text-center text-sm text-muted-foreground">Loading event…</div>
      </ManagementPageShell>
    );
  }

  if (!initialLoaded) {
    return (
      <ManagementPageShell>
        <div className="py-16 text-center text-sm text-muted-foreground">Loading event…</div>
      </ManagementPageShell>
    );
  }

  if (hardError && !event) {
    return <EventDetailHardError message={hardError} onRetry={() => void refresh()} />;
  }
  if (!event) return <EventDetailNotFound />;

  const status = getCheckInStatus(event);
  const opensAt = new Date(event.check_in_opens_at);
  const closesAt = new Date(event.check_in_closes_at);
  const statusBanner = (() => {
    if (status === "open") {
      return {
        tone: "open" as const,
        title: "Check-in is open",
        body: `Closes at ${formatTimestamp(event.check_in_closes_at)}.`,
      };
    }
    if (status === "upcoming") {
      return {
        tone: "upcoming" as const,
        title: "Check-in not open yet",
        body: `Opens at ${formatTimestamp(event.check_in_opens_at)}.`,
      };
    }
    if (status === "archived") {
      return {
        tone: "closed" as const,
        title: "Event archived",
        body: "This event is archived. Students cannot check in.",
      };
    }
    return {
      tone: "closed" as const,
      title: "Check-in is closed",
      body: status === "inactive"
        ? "This event has been deactivated."
        : `Closed at ${formatTimestamp(event.check_in_closes_at)}.`,
    };
  })();

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(checkInUrl);
      toast.success("Check-in link copied");
    } catch {
      toast.error("Unable to copy link");
    }
  };

  const handleExportCsv = async () => {
    if (!event || exporting) return;
    setExporting(true);
    try {
      // Server fn re-checks ownership and produces the canonical CSV from a
      // fresh DB read, so the file always matches server truth — not whatever
      // the last 5s poll happened to capture.
      const result = await exportAttendanceFn({ data: { eventId } });
      // BOM keeps Excel honest about UTF-8 (otherwise non-ASCII names get
      // mangled the moment a host opens the file in Excel on Windows).
      const blob = new Blob(["\ufeff", result.csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      if (result.count === 0) {
        toast.message("Exported empty attendance file", { description: "No one has checked in yet." });
      } else {
        toast.success(`Exported ${result.count} attendance ${result.count === 1 ? "record" : "records"}`);
      }
    } catch (error) {
      toast.error(getManagementErrorMessage(error, "Unable to export attendance."));
    } finally {
      setExporting(false);
    }
  };

  const handleConfirmRemove = async () => {
    if (!pendingRemoveId) return;
    setRemovingId(pendingRemoveId);
    const removeId = pendingRemoveId;
    // Optimistic remove for snappy UX. We re-fetch on success so
    // server-derived fields stay correct.
    const previous = attendance;
    setAttendance((prev) => prev.filter((row) => row.id !== removeId));
    setPendingRemoveId(null);
    try {
      await removeAttendanceMutation({ data: { attendanceRecordId: removeId, eventId } });
      toast.success("Attendance removed");
      await refresh();
    } catch (error) {
      setAttendance(previous);
      toast.error(getManagementErrorMessage(error, "Unable to remove attendance."));
    } finally {
      setRemovingId(null);
    }
  };

  const handleCloseEarly = async () => {
    setClosingEarly(true);
    try {
      await closeEarlyMutation({ data: { eventId } });
      toast.success("Check-in closed");
      await refresh();
      setCloseEarlyOpen(false);
    } catch (error) {
      toast.error(getManagementErrorMessage(error, "Unable to close check-in."));
    } finally {
      setClosingEarly(false);
    }
  };

  const handleDuplicate = async () => {
    if (duplicating) return;
    setDuplicating(true);
    try {
      const result = await duplicateEventMutation({
        data: {
          sourceEventId: eventId,
          clubId: event.club_id,
          eventName: `${event.event_name} (copy)`,
          eventDate: event.event_date,
          startTime: event.start_time,
          endTime: event.end_time ?? event.start_time,
          location: event.location ?? "",
          checkInOpensAt: event.check_in_opens_at,
          checkInClosesAt: event.check_in_closes_at,
        },
      });
      toast.success("Event duplicated");
      navigate({
        to: "/events/$eventId/edit",
        params: { eventId: result.event.id },
        search: { created: "" },
      });
    } catch (error) {
      toast.error(getManagementErrorMessage(error, "Unable to duplicate event."));
    } finally {
      setDuplicating(false);
    }
  };

  const handleManualRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  return (
    <ManagementPageShell>
      <div className="space-y-6 pb-20 md:pb-0">
        <PageHeader
          title={event.event_name}
          description={event.clubs?.club_name ?? "Club event"}
          action={
            <div className="flex flex-wrap gap-2">
              <SecondaryButton asChild>
                <Link to="/events/$eventId/edit" params={{ eventId }} search={{ created: "" }}>
                  <Pencil className="h-4 w-4" />
                  <span className="hidden sm:inline">Edit</span>
                </Link>
              </SecondaryButton>
              <SecondaryButton type="button" onClick={() => void handleDuplicate()} disabled={duplicating}>
                <Copy className="h-4 w-4" />
                <span className="hidden sm:inline">{duplicating ? "Duplicating…" : "Duplicate"}</span>
              </SecondaryButton>
              <SecondaryButton asChild>
                <Link to="/events/$eventId/display" params={{ eventId }} search={{ created: "" }}>
                  <Maximize2 className="h-4 w-4" />
                  <span className="hidden sm:inline">Display QR</span>
                </Link>
              </SecondaryButton>
              <PrimaryButton asChild>
                <Link to="/check-in/$qrToken" params={{ qrToken: event.qr_token }} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4" />
                  <span className="hidden sm:inline">Open student view</span>
                  <span className="sm:hidden">Student view</span>
                </Link>
              </PrimaryButton>
            </div>
          }
        />

        <StatusBanner banner={statusBanner} />

        {softError ? (
          <div className="flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-foreground">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <div className="flex-1 space-y-1">
              <p className="font-medium">Live updates paused</p>
              <p className="text-muted-foreground">{softError} The dashboard is showing the most recent successful snapshot.</p>
            </div>
            <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={() => void handleManualRefresh()}>
              Retry
            </Button>
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-3">
          <StatsCard label="Attendance" value={attendance.length} hint="Live across all check-in methods" />
          <StatsCard
            label="Check-in opens"
            value={Number.isNaN(opensAt.getTime()) ? "—" : opensAt.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
            hint={formatEventDate(event.event_date)}
          />
          <StatsCard
            label="Check-in closes"
            value={Number.isNaN(closesAt.getTime()) ? "—" : closesAt.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
            hint={status === "open" ? "Open right now" : status === "upcoming" ? "Not open yet" : "Closed"}
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_22rem]">
          <Card className="rounded-2xl border-border/70 shadow-sm">
            <CardContent className="space-y-4 p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-semibold text-foreground">Attendance ({attendance.length})</h2>
                    <LiveDot active={initialLoaded && !softError} />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Auto-refreshes every {POLL_INTERVAL_MS / 1000}s
                    {lastRefreshAt ? ` · last update ${formatTime(lastRefreshAt)}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <SecondaryButton type="button" onClick={() => void handleManualRefresh()} disabled={refreshing}>
                    <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                    <span className="hidden sm:inline">Refresh</span>
                  </SecondaryButton>
                  <SecondaryButton
                    type="button"
                    onClick={() => void handleExportCsv()}
                    disabled={exporting}
                    aria-label="Export attendance as CSV"
                  >
                    <Download className={`h-4 w-4 ${exporting ? "animate-pulse" : ""}`} />
                    <span className="hidden sm:inline">{exporting ? "Exporting…" : "Export CSV"}</span>
                  </SecondaryButton>
                  {status === "open" ? (
                    <SecondaryButton type="button" onClick={() => setCloseEarlyOpen(true)}>
                      <X className="h-4 w-4" />
                      <span className="hidden sm:inline">Close check-in</span>
                    </SecondaryButton>
                  ) : null}
                </div>
              </div>

              {attendance.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border/80 px-4 py-12 text-center">
                  <p className="text-sm font-medium text-foreground">No one has checked in yet.</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {status === "open"
                      ? "Share the QR code or check-in link to start collecting attendance."
                      : status === "upcoming"
                        ? `Check-in opens at ${formatTimestamp(event.check_in_opens_at)}.`
                        : "Check-in is closed for this event."}
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-border/70 overflow-hidden rounded-2xl border border-border/70">
                  {attendance.map((row) => (
                    <li key={row.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-foreground">
                            {row.students?.first_name} {row.students?.last_name}
                          </p>
                          <MethodBadge method={row.check_in_method} />
                        </div>
                        <p className="truncate text-sm text-muted-foreground">
                          {row.students?.student_email}
                          {row.students?.nine_hundred_number ? ` · ${row.students.nine_hundred_number}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center justify-between gap-3 sm:justify-end sm:gap-4">
                        <span className="shrink-0 text-sm text-muted-foreground">
                          {formatTimestamp(row.checked_in_at)}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="rounded-xl text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => setPendingRemoveId(row.id)}
                          disabled={removingId === row.id}
                          aria-label={`Remove attendance for ${row.students?.first_name} ${row.students?.last_name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="hidden sm:inline">Remove</span>
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/70 shadow-sm">
            <CardContent className="space-y-4 p-5 sm:p-6">
              <div className="space-y-1">
                <h2 className="text-base font-semibold text-foreground">QR check-in</h2>
                <p className="text-sm text-muted-foreground">Print, project, or share the link below.</p>
              </div>

              <div className="mx-auto w-full max-w-[16rem] rounded-2xl bg-white p-4">
                {checkInUrl ? <QRCode value={checkInUrl} size={224} className="h-auto w-full" /> : null}
              </div>

              <div className="space-y-2 rounded-2xl bg-secondary p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Check-in URL</p>
                <p className="break-all text-xs text-foreground">{checkInUrl}</p>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" className="flex-1 rounded-xl" onClick={() => void handleCopyLink()}>
                    <Copy className="h-4 w-4" />Copy link
                  </Button>
                  <Button asChild type="button" variant="outline" className="flex-1 rounded-xl">
                    <Link to="/events/$eventId/display" params={{ eventId }} search={{ created: "" }}>
                      <Maximize2 className="h-4 w-4" />Full screen
                    </Link>
                  </Button>
                </div>
              </div>

              <div className="space-y-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2"><CalendarDays className="h-4 w-4" />{formatEventDate(event.event_date)}</div>
                <div className="flex items-center gap-2"><Clock3 className="h-4 w-4" />{formatEventTime(event.start_time, event.end_time)}</div>
                {event.location ? (
                  <div className="flex items-center gap-2"><MapPin className="h-4 w-4" />{event.location}</div>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <AlertDialog open={pendingRemoveId !== null} onOpenChange={(open) => !open && setPendingRemoveId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this attendance?</AlertDialogTitle>
            <AlertDialogDescription>
              This deletes the attendance record. The action is recorded in the audit log and the student can re-check in if check-in is still open.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleConfirmRemove()}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={closeEarlyOpen} onOpenChange={setCloseEarlyOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Close check-in now?</AlertDialogTitle>
            <AlertDialogDescription>
              Students will no longer be able to check in for this event after closing. You can edit the event later to reopen the window.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleCloseEarly()} disabled={closingEarly}>
              {closingEarly ? "Closing…" : "Close check-in"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ManagementPageShell>
  );
}

type BannerProps = {
  banner: { tone: "open" | "upcoming" | "closed"; title: string; body: string };
};

function StatusBanner({ banner }: BannerProps) {
  const toneClasses = {
    open: "border-success/30 bg-success/10 text-foreground",
    upcoming: "border-accent bg-accent/40 text-foreground",
    closed: "border-border bg-muted text-foreground",
  }[banner.tone];

  return (
    <div className={`flex flex-col gap-1 rounded-2xl border px-4 py-3 ${toneClasses}`}>
      <p className="text-sm font-semibold">{banner.title}</p>
      <p className="text-sm text-muted-foreground">{banner.body}</p>
    </div>
  );
}

function LiveDot({ active }: { active: boolean }) {
  if (!active) {
    return <span className="h-2 w-2 rounded-full bg-muted-foreground/40" aria-hidden />;
  }
  return (
    <span className="relative flex h-2 w-2" aria-label="Live">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success/60 opacity-75" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
    </span>
  );
}

function MethodBadge({ method }: { method: string | null | undefined }) {
  const label = method ? METHOD_LABEL[method] ?? "Manual" : "Manual";
  return (
    <span className="inline-flex items-center rounded-full border border-border/70 bg-muted px-2 py-0.5 text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground">
      {label}
    </span>
  );
}

function formatTime(date: Date) {
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" });
}
