import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { CalendarDays, Clock3, Copy, MapPin, Plus, Search, WandSparkles } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { useAttendanceAuth } from "@/components/attendance-hq/auth-provider";
import { HostAppShell } from "@/components/attendance-hq/host-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  formatEventDate,
  formatEventTime,
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
} from "@/lib/attendance-hq-schemas";
import { cn } from "@/lib/utils";

export function ManagementPageShell({ children }: { children: React.ReactNode }) {
  return <HostAppShell>{children}</HostAppShell>;
}

export function PageHeader({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">{title}</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}

export function FormCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return <Card className={cn("rounded-2xl border-border/70 shadow-sm", className)}><CardContent className="p-5 sm:p-6">{children}</CardContent></Card>;
}

export function StatsCard({ label, value, hint }: { label: string; value: string | number; hint: string }) {
  return (
    <Card className="rounded-2xl border-border/70 shadow-sm">
      <CardContent className="space-y-2 p-5">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-3xl font-semibold tracking-tight text-foreground">{value}</p>
        <p className="text-sm text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

export function StatusBadge({ active, activeLabel = "Active", inactiveLabel = "Inactive" }: { active: boolean; activeLabel?: string; inactiveLabel?: string }) {
  return (
    <span className={cn(
      "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold",
      active ? "bg-secondary text-foreground" : "bg-muted text-muted-foreground",
    )}>
      {active ? activeLabel : inactiveLabel}
    </span>
  );
}

export function PrimaryButton(props: React.ComponentProps<typeof Button>) {
  return <Button {...props} className={cn("h-11 rounded-xl px-4", props.className)} />;
}

export function SecondaryButton(props: React.ComponentProps<typeof Button>) {
  return <Button variant="outline" {...props} className={cn("h-11 rounded-xl px-4", props.className)} />;
}

export function TextInput({ label, error, className, ...props }: React.ComponentProps<typeof Input> & { label: string; error?: string }) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-foreground">{label}</Label>
      <Input {...props} className={cn("h-11 rounded-xl", className)} />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

export function TextAreaInput({ label, error, className, ...props }: React.ComponentProps<typeof Textarea> & { label: string; error?: string }) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-foreground">{label}</Label>
      <Textarea {...props} className={cn("min-h-28 rounded-xl", className)} />
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
      <Input value={value} onChange={(event) => onChange(event.target.value)} placeholder="Search events" className="h-11 rounded-xl pl-9" />
    </div>
  );
}

const EMPTY_SELECT_VALUE = "__empty__";

export function SelectInput({ label, value, onValueChange, placeholder, options }: { label: string; value: string; onValueChange: (value: string) => void; placeholder: string; options: { value: string; label: string }[] }) {
  return (
    <div className="space-y-2 min-w-[10rem]">
      <Label className="text-sm font-medium text-foreground">{label}</Label>
      <Select value={value || EMPTY_SELECT_VALUE} onValueChange={(nextValue) => onValueChange(nextValue === EMPTY_SELECT_VALUE ? "" : nextValue)}>
        <SelectTrigger className="h-11 rounded-xl">
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
    <Card className="rounded-2xl border-dashed border-border/80 shadow-none">
      <CardContent className="flex flex-col items-center justify-center gap-3 p-8 text-center">
        <div className="text-lg font-semibold text-foreground">{title}</div>
        <div className="max-w-md text-sm text-muted-foreground">{description}</div>
        {action}
      </CardContent>
    </Card>
  );
}

export function FilterBar({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-4 sm:flex-row sm:flex-wrap sm:items-end">{children}</div>;
}

export function ClubCard({ club }: { club: ClubSummary }) {
  return (
    <Card className="rounded-2xl border-border/70 shadow-sm">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-foreground">{club.club_name}</h2>
            <p className="text-sm text-muted-foreground">{club.description || "No description added yet."}</p>
          </div>
          <StatusBadge active={club.is_active} />
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <MetaPill label="Upcoming" value={club.upcomingEventsCount} />
          <MetaPill label="Past" value={club.pastEventsCount} />
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <SecondaryButton asChild className="flex-1"><Link to="/clubs/$clubId" params={{ clubId: club.id }}>Manage Club</Link></SecondaryButton>
          <PrimaryButton asChild className="flex-1"><Link to="/events/new" search={{ clubId: club.id }}>Create Event</Link></PrimaryButton>
        </div>
      </CardContent>
    </Card>
  );
}

export function EventCard({ event, showClub = true, onDuplicate }: { event: ManagementEventSummary; showClub?: boolean; onDuplicate?: (eventId: string) => void }) {
  return (
    <Card className="rounded-2xl border-border/70 shadow-sm">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <h3 className="truncate text-lg font-semibold text-foreground">{event.event_name}</h3>
            {showClub ? <p className="text-sm text-muted-foreground">{event.clubs?.club_name}</p> : null}
          </div>
          <StatusBadge active={event.checkInStatus === "open" || event.checkInStatus === "upcoming"} activeLabel={event.checkInStatus === "open" ? "Open" : "Upcoming"} inactiveLabel={event.checkInStatus === "archived" ? "Archived" : "Past"} />
        </div>
        <div className="space-y-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-2"><CalendarDays className="h-4 w-4" />{formatEventDate(event.event_date)}</div>
          <div className="flex items-center gap-2"><Clock3 className="h-4 w-4" />{formatEventTime(event.start_time, event.end_time)}</div>
          {event.location ? <div className="flex items-center gap-2"><MapPin className="h-4 w-4" />{event.location}</div> : null}
        </div>
        <div className="flex items-center justify-between rounded-xl bg-secondary px-4 py-3 text-sm">
          <span className="text-muted-foreground">Attendance</span>
          <span className="font-semibold text-foreground">{event.attendanceCount}</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <SecondaryButton asChild><Link to="/events/$eventId" params={{ eventId: event.id }}>Manage</Link></SecondaryButton>
          <SecondaryButton asChild><Link to="/events/$eventId/edit" params={{ eventId: event.id }}>Edit</Link></SecondaryButton>
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
  return <div className="rounded-xl bg-secondary px-4 py-3"><div className="text-muted-foreground">{label}</div><div className="mt-1 text-base font-semibold text-foreground">{value}</div></div>;
}

export function useRequireHostRedirect() {
  const navigate = useNavigate();
  const { user, loading } = useAttendanceAuth();

  useEffect(() => {
    if (!loading && !user) {
      navigate({ to: "/sign-in" });
    }
  }, [loading, navigate, user]);

  return { user, loading };
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
      setError(submitError instanceof Error ? submitError.message : "Unable to save club.");
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(event) => void submit(event)}>
          <TextInput label="Club name" error={form.formState.errors.clubName?.message} {...form.register("clubName")} />
          <TextAreaInput label="Description" error={form.formState.errors.description?.message} {...form.register("description")} />
          {isEdit ? (
            <div className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
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
      setError(submitError instanceof Error ? submitError.message : "Unable to save template.");
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Template" : "Create Template"}</DialogTitle>
          <DialogDescription>Save lightweight defaults for recurring events.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(event) => void submit(event)}>
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

function getOffsetMinutes(referenceIso: string, eventDate: string, startTime: string) {
  const reference = new Date(referenceIso).getTime();
  const eventStart = new Date(combineDateAndTime(eventDate, `${startTime}:00`)).getTime();
  if (Number.isNaN(reference) || Number.isNaN(eventStart)) return 0;
  return Math.round((reference - eventStart) / 60000);
}

function DateTimeReadonly({ label, value }: { label: string; value: string }) {
  const date = new Date(value);
  const formatted = Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

  return (
    <div className="space-y-2 rounded-xl border border-border/70 bg-secondary/40 px-4 py-3">
      <p className="text-sm font-medium text-foreground">{label}</p>
      <p className="text-sm text-muted-foreground">{formatted}</p>
    </div>
  );
}

export function EventForm({ payload, title, description, submitLabel, onSubmit, cancelAction }: { payload: EventFormPayload; title: string; description: string; submitLabel: string; onSubmit: (values: EventValues | EventUpdateValues) => Promise<void>; cancelAction?: React.ReactNode }) {
  const navigate = useNavigate();
  const form = useForm<EventFormValues>({
    resolver: zodResolver(eventSchema),
    defaultValues: payload.initialValues,
  });
  const [error, setError] = useState("");
  const [offsets, setOffsets] = useState(() => ({
    openMinutes: getOffsetMinutes(payload.initialValues.checkInOpensAt, payload.initialValues.eventDate, payload.initialValues.startTime),
    closeMinutes: getOffsetMinutes(payload.initialValues.checkInClosesAt, payload.initialValues.eventDate, payload.initialValues.startTime),
  }));

  useEffect(() => {
    form.reset(payload.initialValues);
    setOffsets({
      openMinutes: getOffsetMinutes(payload.initialValues.checkInOpensAt, payload.initialValues.eventDate, payload.initialValues.startTime),
      closeMinutes: getOffsetMinutes(payload.initialValues.checkInClosesAt, payload.initialValues.eventDate, payload.initialValues.startTime),
    });
  }, [form, payload.initialValues]);

  const eventDate = form.watch("eventDate");
  const startTime = form.watch("startTime");

  useEffect(() => {
    if (!eventDate || !startTime) return;
    form.setValue("checkInOpensAt", combineDateAndTime(eventDate, `${shiftTimeString(startTime, offsets.openMinutes)}:00`), { shouldValidate: true });
    form.setValue("checkInClosesAt", combineDateAndTime(eventDate, `${shiftTimeString(startTime, offsets.closeMinutes)}:00`), { shouldValidate: true });
  }, [eventDate, form, offsets.closeMinutes, offsets.openMinutes, startTime]);

  const submit = form.handleSubmit(async (values) => {
    setError("");
    try {
      await onSubmit(values);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to save event.");
    }
  });

  const selectedClubId = form.watch("clubId");
  const templatesForClub = useMemo(() => payload.templates.filter((template) => template.club_id === selectedClubId), [payload.templates, selectedClubId]);

  return (
    <ManagementPageShell>
      <div className="space-y-6 pb-20 md:pb-0">
        <PageHeader title={title} description={description} action={<SecondaryButton asChild><Link to="/events">Back to Events</Link></SecondaryButton>} />
        <div className="space-y-4">
          {templatesForClub.length ? (
            <FormCard>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Start from template</p>
                  <p className="text-sm text-muted-foreground">Use a recurring setup without rebuilding the form from scratch.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {templatesForClub.slice(0, 3).map((template) => (
                    <SecondaryButton key={template.id} type="button" onClick={() => navigate({ to: "/events/new", search: { templateId: template.id } })}>
                      <WandSparkles className="h-4 w-4" />
                      {template.template_name}
                    </SecondaryButton>
                  ))}
                </div>
              </div>
            </FormCard>
          ) : null}
          <FormCard>
            <form className="space-y-4" onSubmit={(event) => void submit(event)}>
              <SelectInput
                label="Club"
                value={form.watch("clubId")}
                onValueChange={(value) => form.setValue("clubId", value, { shouldValidate: true })}
                placeholder="Choose a club"
                options={payload.clubs.map((club) => ({ value: club.id, label: club.club_name }))}
              />
              <TextInput label="Event name" error={form.formState.errors.eventName?.message} {...form.register("eventName")} />
              <div className="grid gap-4 sm:grid-cols-2">
                <DateInput label="Event date" error={form.formState.errors.eventDate?.message} {...form.register("eventDate")} />
                <TextInput label="Location" error={form.formState.errors.location?.message} {...form.register("location")} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <TimeInput label="Start time" error={form.formState.errors.startTime?.message} {...form.register("startTime")} />
                <TimeInput label="End time" error={form.formState.errors.endTime?.message} {...form.register("endTime")} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <input type="hidden" {...form.register("checkInOpensAt")} />
                <input type="hidden" {...form.register("checkInClosesAt")} />
                <DateTimeReadonly label="Check-in opens" value={form.watch("checkInOpensAt")} />
                <DateTimeReadonly label="Check-in closes" value={form.watch("checkInClosesAt")} />
              </div>
              {form.formState.errors.checkInOpensAt?.message ? <p className="text-sm text-destructive">{form.formState.errors.checkInOpensAt.message}</p> : null}
              {form.formState.errors.checkInClosesAt?.message ? <p className="text-sm text-destructive">{form.formState.errors.checkInClosesAt.message}</p> : null}
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
                <p className="text-sm text-muted-foreground">You can edit this event later.</p>
                <div className="flex gap-2">
                  {cancelAction ?? <SecondaryButton asChild><Link to="/events">Cancel</Link></SecondaryButton>}
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
