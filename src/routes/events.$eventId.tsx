import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  AlertCircle,
  Archive,
  ArrowDownUp,
  CalendarDays,
  ChevronDown,
  Clock3,
  Copy,
  Download,
  ExternalLink,
  MapPin,
  Maximize2,
  Pencil,
  Plus,
  QrCode,
  RefreshCw,
  RotateCcw,
  Trash2,
  UserPlus,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuthorizedServerFn } from "@/components/attendance-hq/auth-provider";
import {
  ActionSheet,
  ActionSheetItem,
  ManagementPageShell,
  PrimaryButton,
  SecondaryButton,
  getManagementErrorMessage,
  useRequireHostRedirect,
} from "@/components/attendance-hq/host-management";
import {
  ActionTile,
  Chip,
  GroupedList,
  IosSearchField,
  LargeTitleHeader,
  ListRow,
  SectionLabel,
  SegmentedControl,
} from "@/components/attendance-hq/ios";
import { cn } from "@/lib/utils";
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
  const deleteEventMutation = useAuthorizedServerFn(deleteEvent);
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

  const statusChipTone: "success" | "blue" | "muted" | "destructive" =
    status === "open" ? "success" : status === "upcoming" ? "blue" : status === "archived" ? "destructive" : "muted";

  const historyOptions = [
    { value: "recent" as const, label: "Recent" },
    { value: "removed" as const, label: "Removed" },
    { value: "actions" as const, label: "Actions" },
    { value: "review" as const, label: "Review" },
  ];

  return (
    <ManagementPageShell>
      <div className="space-y-5 pb-6">
        <LargeTitleHeader
          eyebrow={event.clubs?.club_name ?? "Club event"}
          title={event.event_name}
          trailing={
            <Button asChild variant="tonal" size="icon" className="rounded-full" aria-label="Edit event">
              <Link to="/events/$eventId/edit" params={{ eventId }} search={{ created: "" }}>
                <Pencil className="h-[18px] w-[18px]" />
              </Link>
            </Button>
          }
        />

        {/* Hero card */}
        <div
          className={cn(
            "rounded-[1.75rem] p-5",
            status === "open" ? "hero-wash text-foreground" : "ios-card",
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-1.5">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                <p className="text-[14px] font-semibold text-foreground">{formatEventDate(event.event_date)}</p>
              </div>
              <div className="flex items-center gap-2">
                <Clock3 className="h-4 w-4 text-muted-foreground" />
                <p className="text-[14px] text-foreground/90">{formatEventTime(event.start_time, event.end_time)}</p>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <p className="truncate text-[14px] text-foreground/90">{event.location || "Location TBA"}</p>
              </div>
            </div>
            <Chip tone={statusChipTone}>
              {status === "open" ? "Live" : status === "upcoming" ? "Upcoming" : status === "archived" ? "Archived" : "Closed"}
            </Chip>
          </div>
          <div className="mt-4 flex items-end justify-between border-t border-border/60 pt-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Checked in</p>
              <p className="font-display text-[34px] font-extrabold leading-none tracking-tight text-foreground">
                {summary?.total ?? attendance.length}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Recent</p>
              <p className="font-display text-[20px] font-bold text-foreground">
                {summary?.recent ?? 0}
                <span className="ml-1 text-[12px] font-medium text-muted-foreground">/ 15m</span>
              </p>
            </div>
          </div>
        </div>

        {softError ? (
          <div className="flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-foreground">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <div className="flex-1 space-y-1">
              <p className="font-medium">Live updates paused</p>
              <p className="text-muted-foreground">{softError}</p>
            </div>
            <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={() => void handleManualRefresh()}>
              Retry
            </Button>
          </div>
        ) : null}

        {/* 2x2 quick actions */}
        <div className="grid grid-cols-2 gap-3">
          <ActionTile
            icon={QrCode}
            label="Show QR"
            hint="Full screen"
            tone="gold"
            to="/events/$eventId/display"
            params={{ eventId }}
            search={{ created: "" }}
          />
          <ActionTile
            icon={UserPlus}
            label="Manual check-in"
            hint="Add a student"
            tone="blue"
            onClick={() => setManualDialogOpen(true)}
          />
          <ActionTile
            icon={Maximize2}
            label="Display"
            hint="Project to TV"
            to="/events/$eventId/display"
            params={{ eventId }}
            search={{ created: "" }}
          />
          <ActionTile
            icon={Download}
            label={exporting ? "Exporting…" : "Export CSV"}
            hint="Download roster"
            onClick={() => void handleExportCsv()}
          />
        </div>

        {/* Event tools */}
        <div>
          <SectionLabel>Event tools</SectionLabel>
          <GroupedList>
            <ListRow
              icon={Copy}
              label={duplicating ? "Duplicating…" : "Duplicate event"}
              detail="Create a copy you can edit"
              onClick={() => void handleDuplicate()}
            />
            {status === "open" ? (
              <ListRow
                icon={X}
                iconBg="bg-destructive/10"
                iconColor="text-destructive"
                label="Close check-in early"
                detail="Stop accepting new check-ins now"
                onClick={() => setCloseEarlyOpen(true)}
              />
            ) : null}
            <ListRow
              icon={Archive}
              label={event.is_archived ? "Reopen event" : "Archive event"}
              detail={event.is_archived ? "Bring this event back to active" : "Hide from active operations"}
              onClick={() => setArchiveDialogOpen(true)}
            />
            <ListRow
              icon={RefreshCw}
              label={refreshing ? "Refreshing…" : "Refresh now"}
              detail={lastRefreshAt ? `Last update ${formatTime(lastRefreshAt)}` : "Pull latest attendance"}
              onClick={() => void handleManualRefresh()}
            />
            <ActionSheet
              trigger={
                <button type="button" className="ios-list-row w-full text-left">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-destructive/10">
                    <Trash2 className="h-[18px] w-[18px] text-destructive" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[15px] font-medium leading-tight text-destructive">Delete event</div>
                    <div className="mt-0.5 text-[13px] text-muted-foreground">Permanently remove this event</div>
                  </div>
                </button>
              }
              title="Delete this event?"
              description="This permanently removes the event, attendance records, and history."
            >
              <ActionSheetItem
                icon={Trash2}
                label="Yes, delete event"
                destructive
                onClick={async () => {
                  try {
                    await deleteEventMutation({ data: { eventId } });
                    toast.success("Event deleted");
                    navigate({ to: "/events", search: { clubId: "", status: "all", query: "" } });
                  } catch (error) {
                    toast.error(getManagementErrorMessage(error, "Unable to delete event."));
                  }
                }}
              />
            </ActionSheet>
          </GroupedList>
        </div>

        {/* Roster */}
        <div>
          <div className="mb-2 flex items-center justify-between px-3">
            <p className="ios-section-label">Roster · {filteredAttendance.length}</p>
            <Popover>
              <PopoverTrigger asChild>
                <Button type="button" variant="ghost" size="sm" className="h-8 rounded-full px-2 text-muted-foreground" aria-label="Sort">
                  <ArrowDownUp className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-44 rounded-2xl p-2">
                <button
                  type="button"
                  className={cn("ios-list-row w-full text-left", sortMode === "newest" && "text-primary")}
                  onClick={() => setSortMode("newest")}
                >
                  <span className="text-[14px] font-medium">Newest first</span>
                </button>
                <button
                  type="button"
                  className={cn("ios-list-row w-full text-left", sortMode === "oldest" && "text-primary")}
                  onClick={() => setSortMode("oldest")}
                >
                  <span className="text-[14px] font-medium">Oldest first</span>
                </button>
                <button
                  type="button"
                  className={cn("ios-list-row w-full text-left", sortMode === "name" && "text-primary")}
                  onClick={() => setSortMode("name")}
                >
                  <span className="text-[14px] font-medium">Name</span>
                </button>
              </PopoverContent>
            </Popover>
          </div>
          <div className="ios-card space-y-3 p-3">
            <IosSearchField value={rosterQuery} onChange={setRosterQuery} placeholder="Search name, email, 900#" />
            <SegmentedControl<RosterMethodFilter>
              value={methodFilter}
              onChange={setMethodFilter}
              options={[
                { value: "all", label: "All" },
                { value: "qr_scan", label: "Scan" },
                { value: "returning_lookup", label: "Return" },
                { value: "host_correction", label: "Manual" },
              ]}
            />
            {filteredAttendance.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/80 px-4 py-10 text-center">
                <p className="text-[14px] font-medium text-foreground">No matching attendance.</p>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  {attendance.length === 0
                    ? status === "open"
                      ? "Share the QR or use manual check-in."
                      : status === "upcoming"
                        ? `Opens at ${formatTimestamp(event.check_in_opens_at)}.`
                        : "Check-in is closed."
                    : "Try a different filter."}
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-border/70 overflow-hidden rounded-2xl border border-border/70 bg-card">
                {filteredAttendance.map((row) => {
                  const initials = `${row.students?.first_name?.[0] ?? ""}${row.students?.last_name?.[0] ?? ""}`.toUpperCase() || "?";
                  return (
                    <li key={row.id} className="flex items-center gap-3 px-3 py-2.5">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[12.5px] font-bold text-primary">
                        {initials}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14.5px] font-medium text-foreground">
                          {row.students?.first_name} {row.students?.last_name}
                        </p>
                        <p className="truncate text-[12px] text-muted-foreground">
                          {formatTimestamp(row.checked_in_at)} · {getCheckInMethodLabel(row.check_in_method)}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => setPendingRemoveRow(row)}
                        disabled={removingId === row.id}
                        aria-label={`Remove ${row.students?.first_name} ${row.students?.last_name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* History tabs */}
        <div>
          <SectionLabel>History</SectionLabel>
          <div className="ios-card space-y-3 p-3">
            <SegmentedControl
              value={historyTab}
              onChange={setHistoryTab}
              options={historyOptions}
            />
            {historyTab === "recent" ? (
              recentCheckIns.length ? (
                <ul className="divide-y divide-border/70">
                  {recentCheckIns.map((row) => (
                    <li key={row.id} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-[14px] font-medium text-foreground">
                          {row.students?.first_name} {row.students?.last_name}
                        </p>
                        <p className="text-[12px] text-muted-foreground">{getCheckInMethodLabel(row.check_in_method)}</p>
                      </div>
                      <p className="shrink-0 text-[12px] text-muted-foreground">{formatTimestamp(row.checked_in_at)}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-1 py-2 text-[13px] text-muted-foreground">Recent activity appears here.</p>
              )
            ) : null}
            {historyTab === "removed" ? (
              removedAttendance.length ? (
                <ul className="space-y-2">
                  {removedAttendance.map((action) => (
                    <li key={action.id} className="rounded-xl bg-secondary/50 px-3 py-2.5">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-[14px] font-medium text-foreground">{action.student?.first_name} {action.student?.last_name}</p>
                          <p className="text-[12px] text-muted-foreground">Removed {formatTimestamp(action.created_at)}</p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="rounded-xl"
                          onClick={() => action.student && void handleRestore(action.student.id)}
                          disabled={restoringStudentId === action.student?.id}
                        >
                          <RotateCcw className="h-4 w-4" />
                          {restoringStudentId === action.student?.id ? "…" : "Restore"}
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-1 py-2 text-[13px] text-muted-foreground">No removed attendance.</p>
              )
            ) : null}
            {historyTab === "actions" ? (
              recentActions.length ? (
                <ul className="divide-y divide-border/70">
                  {recentActions.slice(0, 8).map((action) => (
                    <li key={action.id} className="flex items-start justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-[14px] font-medium text-foreground">{actionLabel(action)}</p>
                        <p className="text-[12px] text-muted-foreground">{action.student?.first_name} {action.student?.last_name}</p>
                      </div>
                      <p className="shrink-0 text-[12px] text-muted-foreground">{formatTimestamp(action.created_at)}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-1 py-2 text-[13px] text-muted-foreground">No recent actions.</p>
              )
            ) : null}
            {historyTab === "review" ? (
              <div className="grid grid-cols-2 gap-2">
                <ReviewTile label="First scan" value={summary?.methodBreakdown.firstScan ?? 0} />
                <ReviewTile label="Returning" value={summary?.methodBreakdown.returning ?? 0} />
                <ReviewTile label="Remembered" value={summary?.methodBreakdown.remembered ?? 0} />
                <ReviewTile label="Manual" value={summary?.methodBreakdown.manual ?? 0} />
              </div>
            ) : null}
          </div>
        </div>

        {/* Collapsible QR */}
        <details className="ios-card group rounded-[1.5rem] p-0">
          <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3.5 [&::-webkit-details-marker]:hidden">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/20 text-accent-foreground">
                <QrCode className="h-[18px] w-[18px]" />
              </span>
              <div>
                <p className="text-[15px] font-semibold text-foreground">QR check-in</p>
                <p className="text-[12px] text-muted-foreground">Tap to view code & link</p>
              </div>
            </div>
            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
          </summary>
          <div className="space-y-3 px-4 pb-4">
            <div className="mx-auto w-full max-w-[14rem] rounded-2xl bg-white p-3 shadow-sm">
              {checkInUrl ? <QRCode value={checkInUrl} size={200} className="h-auto w-full" /> : null}
            </div>
            <div className="space-y-2 rounded-2xl bg-secondary/60 p-3">
              <p className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Check-in URL</p>
              <p className="break-all text-[12px] text-foreground">{checkInUrl}</p>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" className="flex-1 rounded-xl" onClick={() => void handleCopyLink()}>
                  <Copy className="h-4 w-4" />Copy
                </Button>
                <Button asChild type="button" variant="outline" size="sm" className="flex-1 rounded-xl">
                  <Link to="/check-in/$qrToken" params={{ qrToken: event.qr_token }} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-4 w-4" />Open
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </details>
      </div>

      <Dialog open={manualDialogOpen} onOpenChange={setManualDialogOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto rounded-[2rem] border-border/90 bg-card/98 p-0 sm:max-w-lg">
          <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-muted" />
          <DialogHeader>
            <div className="px-6 pt-3">
              <DialogTitle className="text-left text-[22px] font-semibold text-foreground">Manual check-in</DialogTitle>
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

function ReviewTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-secondary/60 px-3 py-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-display text-[20px] font-bold text-foreground">{value}</p>
    </div>
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
