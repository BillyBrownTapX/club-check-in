import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { CalendarDays, ChevronRight, Clock3, Copy, MapPin, Plus, Search, WandSparkles } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { useAttendanceAuth, useAuthorizedServerFn } from "@/components/attendance-hq/auth-provider";
import { HostAppShell } from "@/components/attendance-hq/host-shell";
import { getHostOnboardingState } from "@/lib/attendance-hq.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  combineDateAndTime,
  formatEventDate,
  formatEventTime,
  getCheckInMethodLabel,
  shiftTimeString,
  type Club,
  type ClubSummary,
  type EventFormPayload,
  type EventFormValues,
  type EventListStatusFilter,
  type EventTemplateWithClub,
  type ManagementEventSummary,
} from "@/lib/attendance-hq";
import {
  clubSchema,
  clubUpdateSchema,
  eventListFilterSchema,
  eventSchema,
  eventTemplateSchema,
  eventTemplateUpdateSchema,
  eventUpdateSchema,
  validatedEventSchema,
} from "@/lib/attendance-hq-schemas";
import { cn } from "@/lib/utils";

export function ManagementPageShell({ children }: { children: React.ReactNode }) {
  return <HostAppShell>{children}</HostAppShell>;
}

// Centralized error → user message mapping for the host UI.
//
// Server functions in this app are expected to throw EITHER:
//   • a Response with an HTTP status (auth middleware → 401, notFound → 404)
//   • an Error whose .message has already been sanitized by safeMessage()
//     (see src/lib/server-errors.ts) — these messages are safe product copy
//
// As a defense in depth we also drop anything that looks like a raw
// Supabase / Postgres / JWT / fetch error string so a missed call site
// can't silently leak internal data into the UI.
const RAW_ERROR_PATTERNS: RegExp[] = [
  /^[A-Z_]+:/,                                  // "PGRST301: ..." / "JWT_EXPIRED: ..."
  /JWT|jwt/,                                    // any JWT mention
  /supabase/i,                                  // any supabase-branded string
  /postgres|postgrest|psql/i,                   // postgres internals
  /failed to fetch|networkerror|load failed/i,  // raw fetch errors (client toasts these)
  /\bduplicate key value\b/i,                   // unique_violation raw form
  /\bviolates .* constraint\b/i,                // FK / check_violation raw form
  /\brow level security\b/i,                    // RLS internals
];

function looksLikeRawBackendError(message: string): boolean {
  return RAW_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

export function getManagementErrorMessage(error: unknown, fallback = "Something went wrong.") {
  if (error instanceof Response) {
    if (error.status === 401) return "Your session expired. Please sign in again.";
    if (error.status === 403) return "You do not have access to this area.";
    if (error.status === 404) return "That record could not be found.";
    if (error.status === 429) return "Too many attempts. Please wait a moment and try again.";
    if (error.status >= 500) return fallback;
    return fallback;
  }

  if (typeof error === "object" && error !== null && "status" in error && typeof (error as { status?: number }).status === "number") {
    const status = (error as { status: number }).status;
    if (status === 401) return "Your session expired. Please sign in again.";
    if (status === 403) return "You do not have access to this area.";
    if (status === 404) return "That record could not be found.";
    if (status === 429) return "Too many attempts. Please wait a moment and try again.";
    if (status >= 500) return fallback;
  }

  if (error instanceof Error && error.message) {
    // Anything that smells like a raw backend leak gets dropped to the
    // friendly fallback. The original message is logged so developers
    // looking at devtools can still see what really happened.
    if (looksLikeRawBackendError(error.message)) {
      if (typeof console !== "undefined") {
        console.warn("[ui-error] dropped raw backend message", error.message);
      }
      return fallback;
    }
    return error.message;
  }
  return fallback;
}

export function PageHeader({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 rounded-[1.75rem] border border-border/70 bg-card/90 px-4 py-4 shadow-[0_10px_32px_-24px_color-mix(in_oklab,var(--color-primary)_40%,transparent)] backdrop-blur sm:px-5 sm:py-5">
      <div className="space-y-2">
        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Attendance HQ</p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-[2.1rem]">{title}</h1>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      {action ? <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">{action}</div> : null}
    </div>
  );
}

export function FormCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return <Card className={cn("rounded-[1.75rem] border-border/70 bg-card/95 shadow-[0_18px_40px_-28px_color-mix(in_oklab,var(--color-primary)_38%,transparent)]", className)}><CardContent className="p-5 sm:p-6">{children}</CardContent></Card>;
}

export function StatsCard({ label, value, hint }: { label: string; value: string | number; hint: string }) {
  return (
    <Card className="rounded-[1.6rem] border-border/70 bg-card/95 shadow-[0_14px_34px_-26px_color-mix(in_oklab,var(--color-primary)_32%,transparent)]">
      <CardContent className="space-y-2 p-5">
        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
        <p className="text-3xl font-semibold tracking-tight text-foreground sm:text-[2.1rem]">{value}</p>
        <p className="text-sm leading-6 text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

export function StatusBadge({ active, activeLabel = "Active", inactiveLabel = "Inactive" }: { active: boolean; activeLabel?: string; inactiveLabel?: string }) {
  return (
    <span className={cn(
      "inline-flex min-h-8 items-center rounded-full px-3 py-1 text-xs font-semibold",
      active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
    )}>
      {active ? activeLabel : inactiveLabel}
    </span>
  );
}

export function PrimaryButton(props: React.ComponentProps<typeof Button>) {
  return <Button {...props} className={cn("h-12 rounded-2xl px-4 text-sm font-semibold shadow-[0_14px_30px_-20px_color-mix(in_oklab,var(--color-primary)_60%,transparent)]", props.className)} />;
}

export function SecondaryButton(props: React.ComponentProps<typeof Button>) {
  return <Button variant="outline" {...props} className={cn("h-12 rounded-2xl border-border/80 bg-background/80 px-4 text-sm font-semibold", props.className)} />;
}

export function TextInput({ label, error, className, ...props }: React.ComponentProps<typeof Input> & { label: string; error?: string }) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-semibold text-foreground">{label}</Label>
      <Input {...props} className={cn("h-12 rounded-2xl border-border/80 bg-background/90 px-4 text-base", className)} />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

export function TextAreaInput({ label, error, className, ...props }: React.ComponentProps<typeof Textarea> & { label: string; error?: string }) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-semibold text-foreground">{label}</Label>
      <Textarea {...props} className={cn("min-h-28 rounded-2xl border-border/80 bg-background/90 px-4 py-3 text-base", className)} />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

export function DateInput(props: React.ComponentProps<typeof TextInput>) {
  return <TextInput type="date" {...props} />;
}

export function TimeInput(props: React.ComponentProps<typeof TextInput>) {
  return <TextInput type="time" {...props} />;
}

export function SearchInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="relative flex-1 min-w-[12rem]">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input value={value} onChange={(event) => onChange(event.target.value)} placeholder="Search events" className="h-12 rounded-2xl border-border/80 bg-background/90 pl-9 text-base" />
    </div>
  );
}

const EMPTY_SELECT_VALUE = "__empty__";

export function SelectInput({ label, value, onValueChange, placeholder, options }: { label: string; value: string; onValueChange: (value: string) => void; placeholder: string; options: { value: string; label: string }[] }) {
  return (
      <div className="space-y-2 min-w-[10rem]">
      <Label className="text-sm font-semibold text-foreground">{label}</Label>
      <Select value={value || EMPTY_SELECT_VALUE} onValueChange={(nextValue) => onValueChange(nextValue === EMPTY_SELECT_VALUE ? "" : nextValue)}>
        <SelectTrigger className="h-12 rounded-2xl border-border/80 bg-background/90">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => <SelectItem key={option.value || EMPTY_SELECT_VALUE} value={option.value || EMPTY_SELECT_VALUE}>{option.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

export function EmptyStateBlock({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return (
    <Card className="rounded-[1.75rem] border-dashed border-border/80 bg-card/80 shadow-none">
      <CardContent className="flex flex-col items-center justify-center gap-3 p-8 text-center">
        <div className="text-xl font-semibold text-foreground">{title}</div>
        <div className="max-w-md text-sm leading-6 text-muted-foreground">{description}</div>
        {action}
      </CardContent>
    </Card>
  );
}

export function FilterBar({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-3 rounded-[1.6rem] border border-border/70 bg-card/95 p-4 shadow-[0_14px_36px_-28px_color-mix(in_oklab,var(--color-primary)_28%,transparent)] sm:flex-row sm:flex-wrap sm:items-end">{children}</div>;
}

export function ClubCard({ club }: { club: ClubSummary }) {
  return (
    <Card className="rounded-[1.75rem] border-border/70 bg-card/95 shadow-[0_18px_40px_-28px_color-mix(in_oklab,var(--color-primary)_38%,transparent)]">
      <CardContent className="space-y-5 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold text-foreground">{club.club_name}</h2>
            <p className="text-sm leading-6 text-muted-foreground">{club.description || "No description added yet."}</p>
          </div>
          <StatusBadge active={club.is_active} />
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <MetaPill label="Upcoming" value={club.upcomingEventsCount} />
          <MetaPill label="Past" value={club.pastEventsCount} />
        </div>
        <div className="flex flex-col gap-2">
          <SecondaryButton asChild className="flex-1"><Link to="/clubs/$clubId" params={{ clubId: club.id }}>Manage Club</Link></SecondaryButton>
          <PrimaryButton asChild className="flex-1"><Link to="/events/new" search={{ clubId: club.id, templateId: "", duplicateFrom: "" }}>Create Event</Link></PrimaryButton>
        </div>
      </CardContent>
    </Card>
  );
}

export function EventCard({ event, showClub = true, onDuplicate }: { event: ManagementEventSummary; showClub?: boolean; onDuplicate?: (eventId: string) => void }) {
  const statusLabel = event.checkInStatus === "open"
    ? "Open"
    : event.checkInStatus === "upcoming"
      ? "Upcoming"
      : event.checkInStatus === "inactive"
        ? "Inactive"
        : event.checkInStatus === "archived"
          ? "Archived"
          : "Closed";

  const statusHint = event.checkInStatus === "open"
    ? "Actively accepting check-ins"
    : event.checkInStatus === "upcoming"
      ? "Ready for the next meeting"
      : event.checkInStatus === "inactive"
        ? "Closed early by a host"
        : event.checkInStatus === "archived"
          ? "Stored for record keeping"
          : "Review and export attendance";

  return (
    <Card className="rounded-[1.75rem] border-border/70 bg-card/95 shadow-[0_18px_40px_-28px_color-mix(in_oklab,var(--color-primary)_38%,transparent)]">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <h3 className="truncate text-lg font-semibold text-foreground">{event.event_name}</h3>
            {showClub ? <p className="text-sm text-muted-foreground">{event.clubs?.club_name}</p> : null}
          </div>
          <StatusBadge active={event.checkInStatus === "open" || event.checkInStatus === "upcoming"} activeLabel={statusLabel} inactiveLabel={statusLabel} />
        </div>
        <div className="space-y-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-2"><CalendarDays className="h-4 w-4" />{formatEventDate(event.event_date)}</div>
          <div className="flex items-center gap-2"><Clock3 className="h-4 w-4" />{formatEventTime(event.start_time, event.end_time)}</div>
          {event.location ? <div className="flex items-center gap-2"><MapPin className="h-4 w-4" />{event.location}</div> : null}
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <MetaPill label="Attendance" value={event.attendanceCount} />
          <MetaPill label="Status" value={statusLabel} />
        </div>
        <p className="text-sm text-muted-foreground">{statusHint}</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <SecondaryButton asChild><Link to="/events/$eventId" params={{ eventId: event.id }} search={{ created: "" }}>Manage</Link></SecondaryButton>
          <SecondaryButton asChild><Link to="/events/$eventId/edit" params={{ eventId: event.id }} search={{ created: "" }}>Edit</Link></SecondaryButton>
          <SecondaryButton type="button" onClick={() => onDuplicate?.(event.id)}>Duplicate</SecondaryButton>
        </div>
      </CardContent>
    </Card>
  );
}

export function TemplateCard({ template, onUse, onEdit, onDuplicate }: { template: EventTemplateWithClub; onUse: (templateId: string) => void; onEdit: (template: EventTemplateWithClub) => void; onDuplicate: (templateId: string) => void }) {
  return (
    <Card className="rounded-2xl border-border/70 shadow-sm">
      <CardContent className="space-y-4 p-5">
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-foreground">{template.template_name}</h3>
          <p className="text-sm text-muted-foreground">{template.default_location || "Location not set"}</p>
        </div>
        <div className="space-y-1 text-sm text-muted-foreground">
          <p>{template.default_start_time && template.default_end_time ? formatEventTime(template.default_start_time, template.default_end_time) : "Time not set"}</p>
          <p>Open {template.default_check_in_open_offset_minutes} min · Close {template.default_check_in_close_offset_minutes} min</p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <SecondaryButton type="button" onClick={() => onUse(template.id)}>Use</SecondaryButton>
          <SecondaryButton type="button" onClick={() => onEdit(template)}>Edit</SecondaryButton>
          <SecondaryButton type="button" onClick={() => onDuplicate(template.id)}>Duplicate</SecondaryButton>
        </div>
      </CardContent>
    </Card>
  );
}

function MetaPill({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-2xl bg-secondary/80 px-4 py-3"><div className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</div><div className="mt-1 text-base font-semibold text-foreground">{value}</div></div>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Host auth guards — single source of truth for "where should this user be?"
//
// These three hooks replace what used to be ad-hoc useEffect blocks scattered
// across sign-in, sign-up, reset-password, onboarding/club, onboarding/event,
// and the management routes. Every host-side gate now flows through the same
// helpers so refresh / direct-entry / deep-link behaviour matches everywhere.
// ─────────────────────────────────────────────────────────────────────────────

export function useRequireHostRedirect() {
  const navigate = useNavigate();
  const { user, session, loading } = useAttendanceAuth();
  const authLoading = loading || (!!user && !session);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate({ to: "/sign-in" });
    }
  }, [authLoading, navigate, user]);

  return { user, session, loading: authLoading };
}

// Returns a function that, given the current host's session, asks the server
// where they should land next and navigates there. Used by sign-in/sign-up/
// reset-password and by anyone who wants to honour the canonical onboarding
// progression. The server is the only authority on `nextPath` — clients
// never compute it locally.
export function useResolvePostAuthRedirect() {
  const navigate = useNavigate();
  const fetchOnboardingState = useAuthorizedServerFn(getHostOnboardingState);

  return useCallback(
    async (seed?: { fullName?: string; email?: string }) => {
      const { onboarding } = await fetchOnboardingState({ data: seed ?? {} });
      if (onboarding.isComplete && onboarding.event) {
        navigate({
          to: "/events/$eventId",
          params: { eventId: onboarding.event.id },
          search: { created: "" },
        });
        return;
      }
      if (onboarding.nextPath === "/onboarding/event") {
        navigate({ to: "/onboarding/event" });
        return;
      }
      navigate({ to: "/onboarding/club" });
    },
    [fetchOnboardingState, navigate],
  );
}

// Mirror of useRequireHostRedirect for the auth pages: if a logged-in user
// lands on /sign-in or /sign-up, push them into wherever the server says
// they should be. Fires exactly once per mount so a slow redirect can't
// race with itself.
export function useRequireGuestRedirect() {
  const { user, session, loading } = useAttendanceAuth();
  const resolveRedirect = useResolvePostAuthRedirect();
  const fired = useRef(false);
  const authLoading = loading || (!!user && !session);

  useEffect(() => {
    if (authLoading || !user || !session || fired.current) return;
    fired.current = true;
    void resolveRedirect().catch(() => {
      // If the server probe fails (network, transient 5xx) we fall back to
      // the safest workspace entry point. The user can still navigate from
      // there; they're not stranded on an auth page they're already past.
      fired.current = false;
    });
  }, [authLoading, user, session, resolveRedirect]);

  return { loading: authLoading };
}

type ClubCreateValues = z.infer<typeof clubSchema>;
type ClubUpdateValues = z.infer<typeof clubUpdateSchema>;
type TemplateValues = z.infer<typeof eventTemplateSchema>;
type TemplateUpdateValues = z.infer<typeof eventTemplateUpdateSchema>;
type EventValues = z.infer<typeof eventSchema>;
type EventUpdateValues = z.infer<typeof eventUpdateSchema>;

interface DialogBaseProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ClubDialog({ open, onOpenChange, initialValues, onSubmit, title, description }: DialogBaseProps & { initialValues?: Partial<ClubUpdateValues>; onSubmit: (values: ClubCreateValues | ClubUpdateValues) => Promise<void>; title: string; description: string }) {
  const isEdit = Boolean(initialValues?.clubId);
  const form = useForm<ClubCreateValues | ClubUpdateValues>({
    resolver: zodResolver(isEdit ? clubUpdateSchema : clubSchema),
    defaultValues: isEdit
      ? { clubId: initialValues?.clubId ?? "", clubName: initialValues?.clubName ?? "", description: initialValues?.description ?? "", isActive: initialValues?.isActive ?? true }
      : { clubName: "", description: "" },
  });
  const [error, setError] = useState("");

  useEffect(() => {
    form.reset(isEdit
      ? { clubId: initialValues?.clubId ?? "", clubName: initialValues?.clubName ?? "", description: initialValues?.description ?? "", isActive: initialValues?.isActive ?? true }
      : { clubName: "", description: "" });
  }, [form, initialValues, isEdit, open]);

  const submit = form.handleSubmit(async (values) => {
    setError("");
    try {
      await onSubmit(values);
      onOpenChange(false);
    } catch (submitError) {
      setError(getManagementErrorMessage(submitError, "Unable to save club."));
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto rounded-[2rem] border-border/70 p-0 sm:max-w-lg">
        <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-muted" />
        <DialogHeader>
          <div className="px-6 pt-3">
            <DialogTitle className="text-left text-2xl font-semibold text-foreground">{title}</DialogTitle>
            <DialogDescription className="mt-2 text-left text-sm leading-6 text-muted-foreground">{description}</DialogDescription>
          </div>
        </DialogHeader>
        <form className="space-y-4 px-6 pb-6 pt-2" onSubmit={(event) => void submit(event)}>
          <TextInput label="Club name" error={form.formState.errors.clubName?.message} {...form.register("clubName")} />
          <TextAreaInput label="Description" error={form.formState.errors.description?.message} {...form.register("description")} />
          {isEdit ? (
            <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-secondary/35 px-4 py-4">
              <div>
                <p className="text-sm font-medium text-foreground">Club active</p>
                <p className="text-sm text-muted-foreground">Hide inactive clubs from day-to-day management.</p>
              </div>
              <Switch checked={(form.watch("isActive") as boolean | undefined) ?? true} onCheckedChange={(checked) => form.setValue("isActive", checked as never)} />
            </div>
          ) : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <PrimaryButton type="submit" className="w-full">{isEdit ? "Save Club" : "Create Club"}</PrimaryButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function TemplateDialog({ open, onOpenChange, clubId, initialValues, onSubmit }: DialogBaseProps & { clubId: string; initialValues?: Partial<TemplateUpdateValues>; onSubmit: (values: TemplateValues | TemplateUpdateValues) => Promise<void> }) {
  const isEdit = Boolean(initialValues?.templateId);
  const schema = isEdit ? eventTemplateUpdateSchema : eventTemplateSchema;
  const form = useForm<TemplateValues | TemplateUpdateValues>({
    resolver: zodResolver(schema),
    defaultValues: isEdit
      ? {
          templateId: initialValues?.templateId ?? "",
          clubId,
          templateName: initialValues?.templateName ?? "",
          defaultEventName: initialValues?.defaultEventName ?? "",
          defaultLocation: initialValues?.defaultLocation ?? "",
          defaultStartTime: initialValues?.defaultStartTime ?? "",
          defaultEndTime: initialValues?.defaultEndTime ?? "",
          defaultCheckInOpenOffsetMinutes: initialValues?.defaultCheckInOpenOffsetMinutes ?? 15,
          defaultCheckInCloseOffsetMinutes: initialValues?.defaultCheckInCloseOffsetMinutes ?? 20,
        }
      : {
          clubId,
          templateName: "",
          defaultEventName: "",
          defaultLocation: "",
          defaultStartTime: "",
          defaultEndTime: "",
          defaultCheckInOpenOffsetMinutes: 15,
          defaultCheckInCloseOffsetMinutes: 20,
        },
  });
  const [error, setError] = useState("");

  useEffect(() => {
    form.reset(isEdit
      ? {
          templateId: initialValues?.templateId ?? "",
          clubId,
          templateName: initialValues?.templateName ?? "",
          defaultEventName: initialValues?.defaultEventName ?? "",
          defaultLocation: initialValues?.defaultLocation ?? "",
          defaultStartTime: initialValues?.defaultStartTime ?? "",
          defaultEndTime: initialValues?.defaultEndTime ?? "",
          defaultCheckInOpenOffsetMinutes: initialValues?.defaultCheckInOpenOffsetMinutes ?? 15,
          defaultCheckInCloseOffsetMinutes: initialValues?.defaultCheckInCloseOffsetMinutes ?? 20,
        }
      : {
          clubId,
          templateName: "",
          defaultEventName: "",
          defaultLocation: "",
          defaultStartTime: "",
          defaultEndTime: "",
          defaultCheckInOpenOffsetMinutes: 15,
          defaultCheckInCloseOffsetMinutes: 20,
        });
  }, [clubId, form, initialValues, isEdit, open]);

  const submit = form.handleSubmit(async (values) => {
    setError("");
    try {
      await onSubmit(values);
      onOpenChange(false);
    } catch (submitError) {
      setError(getManagementErrorMessage(submitError, "Unable to save template."));
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto rounded-[2rem] border-border/70 p-0 sm:max-w-lg">
        <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-muted" />
        <DialogHeader>
          <div className="px-6 pt-3">
            <DialogTitle className="text-left text-2xl font-semibold text-foreground">{isEdit ? "Edit Template" : "Create Template"}</DialogTitle>
            <DialogDescription className="mt-2 text-left text-sm leading-6 text-muted-foreground">Save lightweight defaults for recurring events.</DialogDescription>
          </div>
        </DialogHeader>
        <form className="space-y-4 px-6 pb-6 pt-2" onSubmit={(event) => void submit(event)}>
          <TextInput label="Template name" error={form.formState.errors.templateName?.message} {...form.register("templateName")} />
          <TextInput label="Default event name" error={form.formState.errors.defaultEventName?.message} {...form.register("defaultEventName")} />
          <TextInput label="Default location" error={form.formState.errors.defaultLocation?.message} {...form.register("defaultLocation")} />
          <div className="grid gap-4 sm:grid-cols-2">
            <TimeInput label="Default start time" error={form.formState.errors.defaultStartTime?.message} {...form.register("defaultStartTime")} />
            <TimeInput label="Default end time" error={form.formState.errors.defaultEndTime?.message} {...form.register("defaultEndTime")} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput type="number" label="Open offset minutes" error={form.formState.errors.defaultCheckInOpenOffsetMinutes?.message} {...form.register("defaultCheckInOpenOffsetMinutes", { valueAsNumber: true })} />
            <TextInput type="number" label="Close offset minutes" error={form.formState.errors.defaultCheckInCloseOffsetMinutes?.message} {...form.register("defaultCheckInCloseOffsetMinutes", { valueAsNumber: true })} />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <PrimaryButton type="submit" className="w-full">{isEdit ? "Save Template" : "Create Template"}</PrimaryButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function getMinutesBeforeStart(referenceIso: string, eventDate: string, startTime: string) {
  const reference = new Date(referenceIso).getTime();
  const eventStart = new Date(combineDateAndTime(eventDate, `${startTime}:00`)).getTime();
  if (Number.isNaN(reference) || Number.isNaN(eventStart)) return 15;
  return Math.max(0, Math.round((eventStart - reference) / 60000));
}

function getMinutesAfterEnd(referenceIso: string, eventDate: string, endTime: string) {
  const reference = new Date(referenceIso).getTime();
  const eventEnd = new Date(combineDateAndTime(eventDate, `${endTime}:00`)).getTime();
  if (Number.isNaN(reference) || Number.isNaN(eventEnd)) return 15;
  return Math.max(0, Math.round((reference - eventEnd) / 60000));
}

function DateTimeReadonly({ label, value }: { label: string; value: string }) {
  const date = new Date(value);
  const formatted = Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

  return (
    <div className="space-y-2 rounded-2xl border border-border/70 bg-secondary/40 px-4 py-3">
      <p className="text-sm font-semibold text-foreground">{label}</p>
      <p className="text-sm text-muted-foreground">{formatted}</p>
    </div>
  );
}

export function EventForm({ payload, title, description, submitLabel, onSubmit, cancelAction }: { payload: EventFormPayload; title: string; description: string; submitLabel: string; onSubmit: (values: EventValues | EventUpdateValues) => Promise<void>; cancelAction?: React.ReactNode }) {
  const navigate = useNavigate();
  const form = useForm<EventFormValues>({
    resolver: zodResolver(validatedEventSchema),
    defaultValues: payload.initialValues,
  });
  const [error, setError] = useState("");
  const [offsets, setOffsets] = useState(() => ({
    openMinutesBeforeStart: getMinutesBeforeStart(payload.initialValues.checkInOpensAt, payload.initialValues.eventDate, payload.initialValues.startTime),
    closeMinutesAfterEnd: getMinutesAfterEnd(payload.initialValues.checkInClosesAt, payload.initialValues.eventDate, payload.initialValues.endTime),
  }));

  useEffect(() => {
    form.reset(payload.initialValues);
    setOffsets({
      openMinutesBeforeStart: getMinutesBeforeStart(payload.initialValues.checkInOpensAt, payload.initialValues.eventDate, payload.initialValues.startTime),
      closeMinutesAfterEnd: getMinutesAfterEnd(payload.initialValues.checkInClosesAt, payload.initialValues.eventDate, payload.initialValues.endTime),
    });
  }, [form, payload.initialValues]);

  const eventDate = form.watch("eventDate");
  const startTime = form.watch("startTime");
  const endTime = form.watch("endTime");

  useEffect(() => {
    if (!eventDate || !startTime || !endTime) return;
    form.setValue("checkInOpensAt", combineDateAndTime(eventDate, `${shiftTimeString(startTime, -offsets.openMinutesBeforeStart)}:00`), { shouldValidate: true });
    form.setValue("checkInClosesAt", combineDateAndTime(eventDate, `${shiftTimeString(endTime, offsets.closeMinutesAfterEnd)}:00`), { shouldValidate: true });
  }, [endTime, eventDate, form, offsets.closeMinutesAfterEnd, offsets.openMinutesBeforeStart, startTime]);

  const submit = form.handleSubmit(async (values) => {
    setError("");
    try {
      await onSubmit(values);
    } catch (submitError) {
      setError(getManagementErrorMessage(submitError, "Unable to save event."));
    }
  });

  const selectedClubId = form.watch("clubId");
  const templatesForClub = useMemo(() => payload.templates.filter((template) => template.club_id === selectedClubId), [payload.templates, selectedClubId]);

  return (
    <ManagementPageShell>
      <div className="space-y-5 pb-20 md:pb-0">
        <PageHeader title={title} description={description} action={<SecondaryButton asChild><Link to="/events" search={{ clubId: "", status: "all", query: "" }}>Back to Events</Link></SecondaryButton>} />
        <div className="space-y-4">
          {templatesForClub.length ? (
            <FormCard>
              <div className="flex flex-col gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">Start from template</p>
                  <p className="text-sm leading-6 text-muted-foreground">Use a recurring setup without rebuilding the form from scratch.</p>
                </div>
                <div className="flex snap-x gap-2 overflow-x-auto pb-1">
                  {templatesForClub.slice(0, 3).map((template) => (
                    <SecondaryButton key={template.id} type="button" className="min-w-fit snap-start" onClick={() => navigate({ to: "/events/new", search: { clubId: selectedClubId || "", templateId: template.id, duplicateFrom: "" } })}>
                      <WandSparkles className="h-4 w-4" />
                      {template.template_name}
                    </SecondaryButton>
                  ))}
                </div>
              </div>
            </FormCard>
          ) : null}
          <FormCard>
            <form className="space-y-5" onSubmit={(event) => void submit(event)}>
              <SelectInput
                label="Club"
                value={form.watch("clubId")}
                onValueChange={(value) => form.setValue("clubId", value, { shouldValidate: true })}
                placeholder="Choose a club"
                options={payload.clubs.map((club) => ({ value: club.id, label: club.club_name }))}
              />
              <TextInput label="Event name" error={form.formState.errors.eventName?.message} {...form.register("eventName")} />
              <div className="grid gap-4">
                <DateInput label="Event date" error={form.formState.errors.eventDate?.message} {...form.register("eventDate")} />
                <TextInput label="Location" error={form.formState.errors.location?.message} {...form.register("location")} />
              </div>
              <div className="grid gap-4">
                <TimeInput label="Start time" error={form.formState.errors.startTime?.message} {...form.register("startTime")} />
                <TimeInput label="End time" error={form.formState.errors.endTime?.message} {...form.register("endTime")} />
              </div>
              <div className="space-y-3 rounded-[1.6rem] border border-border/70 bg-secondary/25 px-4 py-4">
                <div>
                  <p className="text-sm font-semibold text-foreground">Check-in timing</p>
                  <p className="text-sm leading-6 text-muted-foreground">Tune the window for early arrivals, walk-ins, and post-event cleanup.</p>
                </div>
                <div className="grid gap-4">
                  <TextInput
                    type="number"
                    min={0}
                    label="Open minutes before start"
                    value={String(offsets.openMinutesBeforeStart)}
                    onChange={(event) => setOffsets((prev) => ({ ...prev, openMinutesBeforeStart: Math.max(0, Number(event.target.value || 0)) }))}
                  />
                  <TextInput
                    type="number"
                    min={0}
                    label="Close minutes after end"
                    value={String(offsets.closeMinutesAfterEnd)}
                    onChange={(event) => setOffsets((prev) => ({ ...prev, closeMinutesAfterEnd: Math.max(0, Number(event.target.value || 0)) }))}
                  />
                </div>
                <input type="hidden" {...form.register("checkInOpensAt")} />
                <input type="hidden" {...form.register("checkInClosesAt")} />
                <div className="grid gap-4">
                  <DateTimeReadonly label="Check-in opens" value={form.watch("checkInOpensAt")} />
                  <DateTimeReadonly label="Check-in closes" value={form.watch("checkInClosesAt")} />
                </div>
              </div>
              {form.formState.errors.checkInOpensAt?.message ? <p className="text-sm text-destructive">{form.formState.errors.checkInOpensAt.message}</p> : null}
              {form.formState.errors.checkInClosesAt?.message ? <p className="text-sm text-destructive">{form.formState.errors.checkInClosesAt.message}</p> : null}
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              <div className="sticky bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-20 -mx-2 rounded-[1.6rem] border border-border/70 bg-background/92 p-3 shadow-[0_18px_40px_-24px_color-mix(in_oklab,var(--color-primary)_35%,transparent)] backdrop-blur md:static md:mx-0 md:border-0 md:bg-transparent md:p-0 md:shadow-none">
                <p className="mb-3 text-sm leading-6 text-muted-foreground md:mb-2">Saving changes reactivates the event and uses the updated check-in window.</p>
                <div className="flex flex-col gap-2 md:flex-row md:justify-end">
                  {cancelAction ?? <SecondaryButton asChild><Link to="/events" search={{ clubId: "", status: "all", query: "" }}>Cancel</Link></SecondaryButton>}
                  <PrimaryButton type="submit">{submitLabel}</PrimaryButton>
                </div>
              </div>
            </form>
          </FormCard>
        </div>
      </div>
    </ManagementPageShell>
  );
}

export function useEventFilters(initial: z.infer<typeof eventListFilterSchema>) {
  const [filters, setFilters] = useState(initial);
  return {
    filters,
    setClubId: (clubId: string) => setFilters((prev) => ({ ...prev, clubId })),
    setStatus: (status: EventListStatusFilter) => setFilters((prev) => ({ ...prev, status })),
    setQuery: (query: string) => setFilters((prev) => ({ ...prev, query })),
  };
}
