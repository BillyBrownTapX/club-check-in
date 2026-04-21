import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  AlertCircle,
  Archive,
  CalendarDays,
  Clock3,
  Copy,
  Download,
  ExternalLink,
  MapPin,
  Maximize2,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuthorizedServerFn } from "@/components/attendance-hq/auth-provider";
import {
  DeleteConfirmButton,
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
  deleteEvent,
  duplicateEvent,
  exportEventAttendance,
  getEventOperations,
  manualCheckIn,
  removeAttendance,
  restoreAttendance,
  toggleEventArchive,
} from "@/lib/attendance-hq.functions";
import {
  formatEventDate,
  formatEventTime,
  formatTimestamp,
  getCheckInMethodLabel,
  getCheckInStatus,
  type AttendanceActionLog,
  type AttendanceRow,
  type EventAttendanceSummary,
  type EventWithClub,
} from "@/lib/attendance-hq";

const POLL_INTERVAL_MS = 5000;

type RosterMethodFilter = "all" | "qr_scan" | "returning_lookup" | "remembered_device" | "host_correction";
type RosterSort = "newest" | "oldest" | "name";

type ManualFormState = {
  firstName: string;
  lastName: string;
  studentEmail: string;
  nineHundredNumber: string;
};

const EMPTY_MANUAL_FORM: ManualFormState = {
  firstName: "",
  lastName: "",
  studentEmail: "",
  nineHundredNumber: "",
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
  const restoreAttendanceMutation = useAuthorizedServerFn(restoreAttendance);
  const manualCheckInMutation = useAuthorizedServerFn(manualCheckIn);
  const closeEarlyMutation = useAuthorizedServerFn(closeCheckInEarly);
  const duplicateEventMutation = useAuthorizedServerFn(duplicateEvent);
  const exportAttendanceFn = useAuthorizedServerFn(exportEventAttendance);
  const toggleArchiveMutation = useAuthorizedServerFn(toggleEventArchive);

  const [event, setEvent] = useState<EventWithClub | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [removedAttendance, setRemovedAttendance] = useState<AttendanceActionLog[]>([]);
  const [recentActions, setRecentActions] = useState<AttendanceActionLog[]>([]);
  const [summary, setSummary] = useState<EventAttendanceSummary | null>(null);
  const [hardError, setHardError] = useState<string | null>(null);
  const [softError, setSoftError] = useState<string | null>(null);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingRemoveRow, setPendingRemoveRow] = useState<AttendanceRow | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [closeEarlyOpen, setCloseEarlyOpen] = useState(false);
  const [closingEarly, setClosingEarly] = useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [manualDialogOpen, setManualDialogOpen] = useState(false);
  const [manualSubmitting, setManualSubmitting] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);
  const [manualForm, setManualForm] = useState<ManualFormState>(EMPTY_MANUAL_FORM);
  const [restoringStudentId, setRestoringStudentId] = useState<string | null>(null);
  const [lastRefreshAt, setLastRefreshAt] = useState<Date | null>(null);
  const [rosterQuery, setRosterQuery] = useState("");
  const [methodFilter, setMethodFilter] = useState<RosterMethodFilter>("all");
  const [sortMode, setSortMode] = useState<RosterSort>("newest");

  const createdToastFired = useRef(false);
  const inFlightRef = useRef<Promise<void> | null>(null);

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
        setRemovedAttendance(next.removedAttendance);
        setRecentActions(next.recentActions);
        setSummary(next.summary);
        setSoftError(null);
        setHardError(null);
        setLastRefreshAt(new Date());
      } catch (error) {
        const message = getManagementErrorMessage(error, "Unable to load event.");
        if (!event) setHardError(message);
        else setSoftError(message);
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
  }, [loading, refresh, user]);

  useEffect(() => {
    if (!initialLoaded) return;
    const id = window.setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      void refresh();
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [initialLoaded, refresh]);

  const checkInUrl = useMemo(() => {
    if (!event) return "";
    return typeof window === "undefined"
      ? `/check-in/${event.qr_token}`
      : `${window.location.origin}/check-in/${event.qr_token}`;
  }, [event]);

  const filteredAttendance = useMemo(() => {
    const normalizedQuery = rosterQuery.trim().toLowerCase();
    const rows = attendance.filter((row) => {
      if (methodFilter !== "all" && row.check_in_method !== methodFilter) return false;
      if (!normalizedQuery) return true;
      const searchable = [
        row.students?.first_name,
        row.students?.last_name,
        row.students?.student_email,
        row.students?.nine_hundred_number,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return searchable.includes(normalizedQuery);
    });

    return rows.sort((a, b) => {
      if (sortMode === "name") {
        const aName = `${a.students?.last_name ?? ""} ${a.students?.first_name ?? ""}`.trim();
        const bName = `${b.students?.last_name ?? ""} ${b.students?.first_name ?? ""}`.trim();
        return aName.localeCompare(bName);
      }
      const aTime = new Date(a.checked_in_at).getTime();
      const bTime = new Date(b.checked_in_at).getTime();
      return sortMode === "oldest" ? aTime - bTime : bTime - aTime;
    });
  }, [attendance, methodFilter, rosterQuery, sortMode]);

  const recentCheckIns = useMemo(() => attendance.slice(0, 5), [attendance]);

  if (loading || !user) {
    return <ManagementPageShell><div className="py-16 text-center text-sm text-muted-foreground">Loading event…</div></ManagementPageShell>;
  }

  if (!initialLoaded) {
    return <ManagementPageShell><div className="py-16 text-center text-sm text-muted-foreground">Loading event…</div></ManagementPageShell>;
  }

  if (hardError && !event) return <EventDetailHardError message={hardError} onRetry={() => void refresh()} />;
  if (!event) return <EventDetailNotFound />;

  const status = getCheckInStatus(event);
  const opensAt = new Date(event.check_in_opens_at);
  const closesAt = new Date(event.check_in_closes_at);
  const statusBanner = status === "open"
    ? { tone: "open" as const, title: "Check-in is open", body: `Students can check in until ${formatTimestamp(event.check_in_closes_at)}.` }
    : status === "upcoming"
      ? { tone: "upcoming" as const, title: "Check-in opens soon", body: `Students can start checking in at ${formatTimestamp(event.check_in_opens_at)}.` }
      : status === "archived"
        ? { tone: "closed" as const, title: "Event archived", body: "This event is stored for record keeping and is no longer active." }
        : status === "inactive"
          ? { tone: "closed" as const, title: "Closed early", body: "The event was manually closed. Edit the event to reopen the window." }
          : { tone: "closed" as const, title: "Check-in closed", body: `Closed at ${formatTimestamp(event.check_in_closes_at)}.` };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(checkInUrl);
      toast.success("Check-in link copied");
    } catch {
      toast.error("Unable to copy link");
    }
  };

  const handleExportCsv = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const result = await exportAttendanceFn({ data: { eventId } });
      const blob = new Blob(["﻿", result.csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      if (result.count === 0) toast.message("Exported empty attendance file", { description: "No one has checked in yet." });
      else toast.success(`Exported ${result.count} attendance ${result.count === 1 ? "record" : "records"}`);
    } catch (error) {
      toast.error(getManagementErrorMessage(error, "Unable to export attendance."));
    } finally {
      setExporting(false);
    }
  };

  const handleConfirmRemove = async () => {
    if (!pendingRemoveRow) return;
    setRemovingId(pendingRemoveRow.id);
    const row = pendingRemoveRow;
    const previous = attendance;
    setAttendance((prev) => prev.filter((item) => item.id !== row.id));
    setPendingRemoveRow(null);
    try {
      await removeAttendanceMutation({ data: { attendanceRecordId: row.id, eventId } });
      toast.success("Attendance removed");
      await refresh();
    } catch (error) {
      setAttendance(previous);
      toast.error(getManagementErrorMessage(error, "Unable to remove attendance."));
    } finally {
      setRemovingId(null);
    }
  };

  const handleRestore = async (studentId: string) => {
    setRestoringStudentId(studentId);
    try {
      await restoreAttendanceMutation({ data: { eventId, studentId } });
      toast.success("Attendance restored");
      await refresh();
    } catch (error) {
      toast.error(getManagementErrorMessage(error, "Unable to restore attendance."));
    } finally {
      setRestoringStudentId(null);
    }
  };

  const handleManualCheckIn = async () => {
    setManualSubmitting(true);
    setManualError(null);
    try {
      await manualCheckInMutation({ data: { eventId, ...manualForm } });
      toast.success("Manual check-in saved");
      setManualDialogOpen(false);
      setManualForm(EMPTY_MANUAL_FORM);
      await refresh();
    } catch (error) {
      const message = getManagementErrorMessage(error, "Unable to save manual check-in.");
      setManualError(message);
      toast.error(message);
    } finally {
      setManualSubmitting(false);
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

  const handleArchiveToggle = async () => {
    setArchiving(true);
    try {
      await toggleArchiveMutation({ data: { eventId, isArchived: !event.is_archived } });
      toast.success(event.is_archived ? "Event reopened" : "Event archived");
      await refresh();
      setArchiveDialogOpen(false);
    } catch (error) {
      toast.error(getManagementErrorMessage(error, "Unable to update event status."));
    } finally {
      setArchiving(false);
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
      navigate({ to: "/events/$eventId/edit", params: { eventId: result.event.id }, search: { created: "" } });
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
        <div className="space-y-5 pb-20 md:pb-0">
        <PageHeader
          title={event.event_name}
          description={event.clubs?.club_name ?? "Club event"}
          action={
            <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap">
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
              <PrimaryButton type="button" onClick={() => setManualDialogOpen(true)}>
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Manual check-in</span>
                <span className="sm:hidden">Manual</span>
              </PrimaryButton>
            </div>
          }
        />

        <div className="grid grid-cols-2 gap-3">
          <OpsMetric label="Event date" value={formatEventDate(event.event_date)} detail={formatEventTime(event.start_time, event.end_time)} />
          <OpsMetric label="Location" value={event.location || "TBA"} detail={statusBanner.title} />
        </div>

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

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatsCard label="Attendance" value={summary?.total ?? attendance.length} hint="Total checked in" />
          <StatsCard label="Recent arrivals" value={summary?.recent ?? 0} hint="Last 15 minutes" />
          <StatsCard label="Check-in opens" value={Number.isNaN(opensAt.getTime()) ? "—" : opensAt.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} hint={formatEventDate(event.event_date)} />
          <StatsCard label="Check-in closes" value={Number.isNaN(closesAt.getTime()) ? "—" : closesAt.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} hint={status === "open" ? "Open right now" : status === "upcoming" ? "Not open yet" : "Closed / archived"} />
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_24rem]">
          <div className="space-y-6">
            <Card className="rounded-[2rem] border-border/90 bg-card/95 shadow-[0_26px_60px_-36px_color-mix(in_oklab,var(--color-primary)_36%,transparent)]">
              <CardContent className="space-y-4 p-5 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-semibold text-foreground">Live roster</h2>
                      <LiveDot active={initialLoaded && !softError} />
                    </div>
                    <p className="text-sm text-muted-foreground">Auto-refreshes every {POLL_INTERVAL_MS / 1000}s{lastRefreshAt ? ` · last update ${formatTime(lastRefreshAt)}` : ""}</p>
                  </div>
                    <div className="flex flex-wrap gap-2 rounded-[1.4rem] border border-border/80 bg-surface/70 p-2">
                    <SecondaryButton type="button" onClick={() => void handleManualRefresh()} disabled={refreshing}>
                      <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                      <span className="hidden sm:inline">Refresh</span>
                    </SecondaryButton>
                    <SecondaryButton type="button" onClick={() => void handleExportCsv()} disabled={exporting} aria-label="Export attendance as CSV">
                      <Download className={`h-4 w-4 ${exporting ? "animate-pulse" : ""}`} />
                      <span className="hidden sm:inline">{exporting ? "Exporting…" : "Export CSV"}</span>
                    </SecondaryButton>
                    {status === "open" ? (
                      <SecondaryButton type="button" onClick={() => setCloseEarlyOpen(true)}>
                        <X className="h-4 w-4" />
                        <span className="hidden sm:inline">Close check-in</span>
                      </SecondaryButton>
                    ) : null}
                    <SecondaryButton type="button" onClick={() => setArchiveDialogOpen(true)}>
                      <Archive className="h-4 w-4" />
                      <span className="hidden sm:inline">{event.is_archived ? "Reopen" : "Archive"}</span>
                    </SecondaryButton>
                  </div>
                </div>

                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_12rem_12rem]">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input value={rosterQuery} onChange={(event) => setRosterQuery(event.target.value)} placeholder="Search by name, email, or 900 number" className="h-12 rounded-2xl border-border/90 bg-surface pl-9" />
                  </div>
                  <Select value={methodFilter} onValueChange={(value) => setMethodFilter(value as RosterMethodFilter)}>
                    <SelectTrigger className="h-12 rounded-2xl border-border/90 bg-surface"><SelectValue placeholder="Method" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All methods</SelectItem>
                      <SelectItem value="qr_scan">First scan</SelectItem>
                      <SelectItem value="returning_lookup">Returning</SelectItem>
                      <SelectItem value="remembered_device">Remembered</SelectItem>
                      <SelectItem value="host_correction">Manual</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={sortMode} onValueChange={(value) => setSortMode(value as RosterSort)}>
                    <SelectTrigger className="h-12 rounded-2xl border-border/90 bg-surface"><SelectValue placeholder="Sort" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="newest">Newest first</SelectItem>
                      <SelectItem value="oldest">Oldest first</SelectItem>
                      <SelectItem value="name">Name</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(18rem,0.9fr)]">
                  <div className="space-y-3">
                    {filteredAttendance.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-border/80 px-4 py-12 text-center">
                        <p className="text-sm font-medium text-foreground">No matching attendance yet.</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {attendance.length === 0
                            ? status === "open"
                              ? "Share the QR code or use manual check-in to start collecting attendance."
                              : status === "upcoming"
                                ? `Check-in opens at ${formatTimestamp(event.check_in_opens_at)}.`
                                : "Check-in is closed for this event."
                            : "Try changing your roster filters."}
                        </p>
                      </div>
                    ) : (
                      <ul className="divide-y divide-border/80 overflow-hidden rounded-[1.75rem] border border-border/90 bg-surface/60 shadow-[0_18px_36px_-30px_color-mix(in_oklab,var(--color-primary)_20%,transparent)]">
                        {filteredAttendance.map((row) => (
                            <li key={row.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0 flex-1 space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-medium text-foreground">{row.students?.first_name} {row.students?.last_name}</p>
                                <MethodBadge method={row.check_in_method} />
                              </div>
                              <p className="truncate text-sm text-muted-foreground">
                                {row.students?.student_email}
                                {row.students?.nine_hundred_number ? ` · ${row.students.nine_hundred_number}` : ""}
                              </p>
                            </div>
                            <div className="flex items-center justify-between gap-3 sm:justify-end sm:gap-4">
                              <span className="shrink-0 rounded-full border border-border/70 bg-background/80 px-3 py-1 text-xs font-semibold text-muted-foreground">{formatTimestamp(row.checked_in_at)}</span>
                                <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                  className="rounded-2xl text-destructive hover:bg-destructive/10 hover:text-destructive"
                                onClick={() => setPendingRemoveRow(row)}
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
                  </div>

                  <div className="space-y-4">
                    <PanelCard title="Recent arrivals" description="See who just came through the door.">
                      {recentCheckIns.length ? (
                        <ul className="space-y-3">
                          {recentCheckIns.map((row) => (
                            <li key={row.id} className="rounded-xl bg-secondary/50 px-3 py-3">
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <p className="font-medium text-foreground">{row.students?.first_name} {row.students?.last_name}</p>
                                  <p className="text-sm text-muted-foreground">{getCheckInMethodLabel(row.check_in_method)}</p>
                                </div>
                                <p className="text-sm text-muted-foreground">{formatTimestamp(row.checked_in_at)}</p>
                              </div>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-muted-foreground">Recent activity will appear here as students check in.</p>
                      )}
                    </PanelCard>

                    <PanelCard title="Restore removed" description="Bring back accidental removals without leaving the page.">
                      {removedAttendance.length ? (
                        <ul className="space-y-3">
                          {removedAttendance.map((action) => (
                            <li key={action.id} className="rounded-xl bg-secondary/50 px-3 py-3">
                              <div className="space-y-2">
                                <div>
                                  <p className="font-medium text-foreground">{action.student?.first_name} {action.student?.last_name}</p>
                                  <p className="text-sm text-muted-foreground">Removed {formatTimestamp(action.created_at)}</p>
                                </div>
                                <Button type="button" variant="outline" className="w-full rounded-xl" onClick={() => void handleRestore(action.student!.id)} disabled={restoringStudentId === action.student?.id}>
                                  <RotateCcw className="h-4 w-4" />
                                  {restoringStudentId === action.student?.id ? "Restoring…" : "Restore attendance"}
                                </Button>
                              </div>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-muted-foreground">No removed attendance waiting for review.</p>
                      )}
                    </PanelCard>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
              <PanelCard title="Post-event review" description="Keep a clean operational snapshot for follow-up and exports.">
                <div className="grid gap-3 sm:grid-cols-2">
                  <ReviewStat label="First scan" value={summary?.methodBreakdown.firstScan ?? 0} />
                  <ReviewStat label="Returning" value={summary?.methodBreakdown.returning ?? 0} />
                  <ReviewStat label="Remembered" value={summary?.methodBreakdown.remembered ?? 0} />
                  <ReviewStat label="Manual" value={summary?.methodBreakdown.manual ?? 0} />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <MetaRow icon={<CalendarDays className="h-4 w-4" />} label={formatEventDate(event.event_date)} />
                  <MetaRow icon={<Clock3 className="h-4 w-4" />} label={formatEventTime(event.start_time, event.end_time)} />
                  {event.location ? <MetaRow icon={<MapPin className="h-4 w-4" />} label={event.location} /> : null}
                  <MetaRow icon={<Download className="h-4 w-4" />} label="CSV export is the canonical roster" />
                </div>
              </PanelCard>

              <PanelCard title="Recent actions" description="Audit host corrections and recovery work.">
                {recentActions.length ? (
                  <ul className="space-y-3">
                    {recentActions.slice(0, 8).map((action) => (
                      <li key={action.id} className="rounded-xl bg-secondary/50 px-3 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium text-foreground">{actionLabel(action)}</p>
                            <p className="text-sm text-muted-foreground">{action.student?.first_name} {action.student?.last_name}</p>
                          </div>
                          <p className="text-xs text-muted-foreground">{formatTimestamp(action.created_at)}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">Manual actions and removals will appear here.</p>
                )}
              </PanelCard>
            </div>
          </div>

          <div className="space-y-6">
            <Card className="rounded-[2rem] border-border/90 bg-card/95 shadow-[0_26px_60px_-36px_color-mix(in_oklab,var(--color-primary)_36%,transparent)]">
              <CardContent className="space-y-4 p-5 sm:p-6">
                <div className="space-y-1">
                  <h2 className="text-base font-semibold text-foreground">QR check-in</h2>
                  <p className="text-sm text-muted-foreground">Print, project, or share the link below.</p>
                </div>
                <div className="mx-auto w-full max-w-[16rem] rounded-[1.75rem] bg-white p-4 shadow-[0_16px_40px_-24px_rgba(15,23,42,0.24)]">
                  {checkInUrl ? <QRCode value={checkInUrl} size={224} className="h-auto w-full" /> : null}
                </div>
                <div className="space-y-2 rounded-[1.5rem] border border-border/80 bg-secondary p-3">
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
                <div className="flex flex-col gap-2">
                  <PrimaryButton asChild>
                    <Link to="/check-in/$qrToken" params={{ qrToken: event.qr_token }} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-4 w-4" />Open student view
                    </Link>
                  </PrimaryButton>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

        <Dialog open={manualDialogOpen} onOpenChange={setManualDialogOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto rounded-[2rem] border-border/90 bg-card/98 p-0 shadow-[0_28px_72px_-40px_color-mix(in_oklab,var(--color-primary)_42%,transparent)] sm:max-w-lg">
          <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-muted" />
          <DialogHeader>
            <div className="px-6 pt-3">
              <DialogTitle className="text-left text-2xl font-semibold text-foreground">Manual check-in</DialogTitle>
              <DialogDescription className="mt-2 text-left text-sm leading-6 text-muted-foreground">Use this when a student cannot complete the QR flow but still needs to be counted.</DialogDescription>
            </div>
          </DialogHeader>
          <div className="space-y-4 px-6 pb-6 pt-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="First name"><Input className="h-11 rounded-xl" value={manualForm.firstName} onChange={(event) => setManualForm((prev) => ({ ...prev, firstName: event.target.value }))} /></Field>
              <Field label="Last name"><Input className="h-11 rounded-xl" value={manualForm.lastName} onChange={(event) => setManualForm((prev) => ({ ...prev, lastName: event.target.value }))} /></Field>
            </div>
            <Field label="Student email"><Input className="h-11 rounded-xl" type="email" value={manualForm.studentEmail} onChange={(event) => setManualForm((prev) => ({ ...prev, studentEmail: event.target.value }))} /></Field>
            <Field label="900 number"><Input className="h-11 rounded-xl" inputMode="numeric" value={manualForm.nineHundredNumber} onChange={(event) => setManualForm((prev) => ({ ...prev, nineHundredNumber: event.target.value }))} /></Field>
            {manualError ? <p className="text-sm text-destructive">{manualError}</p> : null}
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <SecondaryButton type="button" onClick={() => setManualDialogOpen(false)}>Cancel</SecondaryButton>
              <PrimaryButton type="button" onClick={() => void handleManualCheckIn()} disabled={manualSubmitting}>{manualSubmitting ? "Saving…" : "Save manual check-in"}</PrimaryButton>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={pendingRemoveRow !== null} onOpenChange={(open) => !open && setPendingRemoveRow(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this attendance?</AlertDialogTitle>
            <AlertDialogDescription>
              This deletes the attendance record. The action is recorded in the audit log and the student can be restored or re-check in later.
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
            <AlertDialogAction onClick={() => void handleCloseEarly()} disabled={closingEarly}>{closingEarly ? "Closing…" : "Close check-in"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{event.is_archived ? "Reopen this event?" : "Archive this event?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {event.is_archived
                ? "Reopening makes the event active again. Edit the time window if you want students to check in again."
                : "Archiving removes the event from active operations while keeping the attendance history available for review."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleArchiveToggle()} disabled={archiving}>{archiving ? "Saving…" : event.is_archived ? "Reopen event" : "Archive event"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ManagementPageShell>
  );
}

function PanelCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <Card className="rounded-[1.8rem] border-border/80 bg-card/95 shadow-[0_22px_48px_-34px_color-mix(in_oklab,var(--color-primary)_28%,transparent)]">
      <CardContent className="space-y-4 p-5 sm:p-6">
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

function OpsMetric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-[1.5rem] border border-border/80 bg-surface/70 px-4 py-4 shadow-[0_18px_36px_-30px_color-mix(in_oklab,var(--color-primary)_22%,transparent)]">
      <p className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-sm font-semibold text-foreground">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

function ReviewStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-secondary/50 px-4 py-3">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold text-foreground">{value}</p>
    </div>
  );
}

function MetaRow({ icon, label }: { icon: React.ReactNode; label: string }) {
  return <div className="flex items-center gap-2 rounded-xl bg-secondary/50 px-4 py-3 text-sm text-foreground">{icon}<span>{label}</span></div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label className="text-sm font-medium text-foreground">{label}</Label>{children}</div>;
}

type BannerProps = { banner: { tone: "open" | "upcoming" | "closed"; title: string; body: string } };

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
  if (!active) return <span className="h-2 w-2 rounded-full bg-muted-foreground/40" aria-hidden />;
  return (
    <span className="relative flex h-2 w-2" aria-label="Live">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success/60 opacity-75" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
    </span>
  );
}

function MethodBadge({ method }: { method: string | null | undefined }) {
  return (
    <span className="inline-flex items-center rounded-full border border-border/70 bg-muted px-2 py-0.5 text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground">
      {getCheckInMethodLabel(method)}
    </span>
  );
}

function actionLabel(action: AttendanceActionLog) {
  if (action.action_type === "removed") return "Removed attendance";
  if (action.action_type === "restored") return "Restored attendance";
  return "Manual check-in";
}

function formatTime(date: Date) {
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" });
}
