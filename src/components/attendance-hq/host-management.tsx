import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { CalendarDays, ChevronRight, Clock3, Copy, ImagePlus, Loader2, MapPin, Plus, Search, Trash2, WandSparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSignedLogoUrl } from "@/hooks/use-signed-logo";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { useAttendanceAuth, useAuthorizedServerFn } from "@/components/attendance-hq/auth-provider";
import { HostAppShell } from "@/components/attendance-hq/host-shell";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerClose, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { ActionTile, Chip, GroupedList, LargeTitleHeader, ListRow, SectionLabel, StickyCtaBar } from "@/components/attendance-hq/ios";
import { ChevronDown, MoreHorizontal, Pencil, ArrowLeft } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
  type University,
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

export function ManagementPageShell({ children, hideTabBar }: { children: React.ReactNode; hideTabBar?: boolean }) {
  return <HostAppShell hideTabBar={hideTabBar}>{children}</HostAppShell>;
}

/* ─── Mobile action sheet (bottom drawer) ─────────────────────────────
 * Use for overflow menus on cards / detail screens. Children should be
 * a list of <ActionSheetItem /> rows. */
export function ActionSheet({
  trigger,
  title,
  description,
  children,
}: {
  trigger: React.ReactNode;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Drawer>
      <DrawerTrigger asChild>{trigger}</DrawerTrigger>
      <DrawerContent className="rounded-t-[1.75rem] border-border/80 bg-card pb-safe-1">
        <DrawerHeader className="text-left">
          <DrawerTitle className="font-display text-[17px] font-extrabold text-foreground">{title}</DrawerTitle>
          {description ? <p className="text-[13px] text-muted-foreground">{description}</p> : null}
        </DrawerHeader>
        <div className="px-3 pb-3">
          <div className="ios-grouped">{children}</div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

export function ActionSheetItem({
  icon: Icon,
  label,
  onClick,
  destructive,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  onClick?: () => void;
  destructive?: boolean;
}) {
  return (
    <DrawerClose asChild>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "ios-list-row w-full text-left",
          destructive && "text-destructive",
        )}
      >
        {Icon ? (
          <span className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
            destructive ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary",
          )}>
            <Icon className="h-[18px] w-[18px]" />
          </span>
        ) : null}
        <span className={cn("flex-1 text-[15px] font-medium", destructive ? "text-destructive" : "text-foreground")}>
          {label}
        </span>
      </button>
    </DrawerClose>
  );
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
    <div className="flex flex-col gap-5 overflow-hidden rounded-[2rem] border border-primary/10 bg-card/95 px-5 py-5 shadow-[0_26px_64px_-36px_color-mix(in_oklab,var(--color-primary)_24%,transparent)] backdrop-blur sm:px-6 sm:py-6">
      <div className="space-y-3">
        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-primary/70">Attendance HQ</p>
        <h1 className="font-display text-[2.15rem] font-extrabold tracking-tight text-foreground sm:text-[2.55rem]">{title}</h1>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-[0.98rem]">{description}</p>
      </div>
      {action ? <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">{action}</div> : null}
    </div>
  );
}

export function FormCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return <Card className={cn("rounded-[2rem] border border-primary/10 bg-card/95 shadow-[0_24px_56px_-34px_color-mix(in_oklab,var(--color-primary)_22%,transparent)]", className)}><CardContent className="p-5 sm:p-6">{children}</CardContent></Card>;
}

export function StatsCard({ label, value, hint }: { label: string; value: string | number; hint: string }) {
  return (
    <Card className="rounded-[1.75rem] border border-primary/10 bg-card/95 shadow-[0_22px_48px_-34px_color-mix(in_oklab,var(--color-primary)_20%,transparent)]">
      <CardContent className="space-y-3 p-5">
        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
        <p className="font-display text-[2rem] font-extrabold tracking-tight text-foreground sm:text-[2.2rem]">{value}</p>
        <p className="text-sm leading-6 text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

export function StatusBadge({ active, activeLabel = "Active", inactiveLabel = "Inactive" }: { active: boolean; activeLabel?: string; inactiveLabel?: string }) {
  return (
    <span className={cn(
      "inline-flex min-h-8 items-center rounded-full border px-3 py-1 text-xs font-semibold",
      active ? "border-primary/15 bg-primary/10 text-primary" : "border-border/80 bg-secondary/80 text-muted-foreground",
    )}>
      {active ? activeLabel : inactiveLabel}
    </span>
  );
}

export function PrimaryButton(props: React.ComponentProps<typeof Button>) {
  return <Button {...props} className={cn("h-12 rounded-xl px-5 text-sm font-bold shadow-[0_18px_36px_-20px_color-mix(in_oklab,var(--color-primary)_36%,transparent)]", props.className)} />;
}

export function SecondaryButton(props: React.ComponentProps<typeof Button>) {
  return <Button variant={props.variant ?? "outline"} {...props} className={cn("h-12 rounded-xl px-4 text-sm font-semibold", props.className)} />;
}

export function TextInput({ label, error, className, ...props }: React.ComponentProps<typeof Input> & { label: string; error?: string }) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-semibold text-foreground">{label}</Label>
      <Input {...props} className={cn("h-12 rounded-xl border-primary/10 bg-background/90 px-4 text-base", className)} />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

export function TextAreaInput({ label, error, className, ...props }: React.ComponentProps<typeof Textarea> & { label: string; error?: string }) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-semibold text-foreground">{label}</Label>
      <Textarea {...props} className={cn("min-h-28 rounded-xl border-primary/10 bg-background/90 px-4 py-3 text-base", className)} />
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

export function SelectInput({ label, value, onValueChange, placeholder, options, error, disabled }: { label: string; value: string; onValueChange: (value: string) => void; placeholder: string; options: { value: string; label: string }[]; error?: string; disabled?: boolean }) {
  const safeOptions = options.filter((option) => Boolean(option.value));
  return (
      <div className="space-y-2 min-w-[10rem]">
      <Label className="text-sm font-semibold text-foreground">{label}</Label>
      <Select value={value || EMPTY_SELECT_VALUE} onValueChange={(nextValue) => onValueChange(nextValue === EMPTY_SELECT_VALUE ? "" : nextValue)} disabled={disabled}>
        <SelectTrigger disabled={disabled} className={cn("h-12 rounded-2xl border-border/80 bg-background/90", error && "border-destructive ring-1 ring-destructive/40", disabled && "opacity-60")}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {safeOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
        </SelectContent>
      </Select>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

export function EmptyStateBlock({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return (
    <Card className="rounded-[1.75rem] border-dashed border-primary/15 bg-card/80 shadow-none">
      <CardContent className="flex flex-col items-center justify-center gap-3 p-8 text-center">
        <div className="font-display text-xl font-extrabold text-foreground">{title}</div>
        <div className="max-w-md text-sm leading-6 text-muted-foreground">{description}</div>
        {action}
      </CardContent>
    </Card>
  );
}

export function FilterBar({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-3 rounded-[1.8rem] border border-primary/10 bg-card/95 p-4 shadow-[0_20px_44px_-32px_color-mix(in_oklab,var(--color-primary)_18%,transparent)] sm:flex-row sm:flex-wrap sm:items-end">{children}</div>;
}

export function ClubCard({ club }: { club: ClubSummary }) {
  return (
    <Card className="rounded-[1.9rem] border border-primary/10 bg-card/95 shadow-[0_24px_52px_-34px_color-mix(in_oklab,var(--color-primary)_20%,transparent)]">
      <CardContent className="space-y-5 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <h2 className="font-display text-xl font-extrabold text-foreground">{club.club_name}</h2>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary/70">{club.universities?.name ?? "University needed"}</p>
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

export function EventCard({ event, showClub = true, onDuplicate, onDelete }: { event: ManagementEventSummary; showClub?: boolean; onDuplicate?: (eventId: string) => void; onDelete?: (eventId: string) => Promise<void> }) {
  const navigate = useNavigate();
  const statusLabel = event.checkInStatus === "open"
    ? "Live"
    : event.checkInStatus === "upcoming"
      ? "Soon"
      : event.checkInStatus === "inactive"
        ? "Closed"
        : event.checkInStatus === "archived"
          ? "Archived"
          : "Past";

  const statusTone: React.ComponentProps<typeof Chip>["tone"] = event.checkInStatus === "open"
    ? "success"
    : event.checkInStatus === "upcoming"
      ? "gold"
      : "muted";

  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  return (
    <div className="ios-card relative rounded-2xl p-4">
      <Link
        to="/events/$eventId"
        params={{ eventId: event.id }}
        search={{ created: "" }}
        className="ios-press block pr-10"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-[16px] font-semibold leading-tight text-foreground">{event.event_name}</h3>
            {showClub && event.clubs?.club_name ? (
              <p className="mt-0.5 truncate text-[12.5px] text-muted-foreground">{event.clubs.club_name}</p>
            ) : null}
          </div>
          <Chip tone={statusTone} className="shrink-0">{statusLabel}</Chip>
        </div>
        <p className="mt-2 truncate text-[13px] text-muted-foreground">
          {formatEventDate(event.event_date)} · {formatEventTime(event.start_time, event.end_time)}
          {event.location ? ` · ${event.location}` : ""}
        </p>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-[13px] font-semibold text-foreground">{event.attendanceCount ?? 0} checked in</span>
        </div>
      </Link>
      <div className="absolute right-3 top-3">
        <ActionSheet
          trigger={
            <button
              type="button"
              aria-label="Event actions"
              className="ios-press flex h-9 w-9 items-center justify-center rounded-full bg-muted text-muted-foreground"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="h-5 w-5" />
            </button>
          }
          title={event.event_name}
          description="Event actions"
        >
          <ActionSheetItem
            icon={ChevronRight}
            label="Manage event"
            onClick={() => navigate({ to: "/events/$eventId", params: { eventId: event.id }, search: { created: "" } })}
          />
          <ActionSheetItem
            icon={Pencil}
            label="Edit event"
            onClick={() => navigate({ to: "/events/$eventId/edit", params: { eventId: event.id }, search: { created: "" } })}
          />
          {onDuplicate ? (
            <ActionSheetItem icon={Copy} label="Duplicate" onClick={() => onDuplicate(event.id)} />
          ) : null}
          {onDelete ? (
            <ActionSheetItem
              icon={Trash2}
              label="Delete event"
              destructive
              onClick={() => setConfirmDeleteOpen(true)}
            />
          ) : null}
        </ActionSheet>
      </div>
      {onDelete ? (
        <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this event?</AlertDialogTitle>
              <AlertDialogDescription>
                This permanently removes the event, its attendance records, and action history. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={async () => {
                  try { await onDelete(event.id); } catch (e) { toast.error(getManagementErrorMessage(e, "Unable to delete.")); }
                }}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
    </div>
  );
}

export function TemplateCard({ template, onUse, onEdit, onDuplicate }: { template: EventTemplateWithClub; onUse: (templateId: string) => void; onEdit: (template: EventTemplateWithClub) => void; onDuplicate: (templateId: string) => void }) {
  return (
    <div className="ios-card relative rounded-2xl p-4">
      <button
        type="button"
        onClick={() => onUse(template.id)}
        className="ios-press block w-full pr-10 text-left"
      >
        <h3 className="text-[15.5px] font-semibold text-foreground">{template.template_name}</h3>
        <p className="mt-0.5 text-[13px] text-muted-foreground">
          {template.default_start_time && template.default_end_time
            ? formatEventTime(template.default_start_time, template.default_end_time)
            : "Time not set"}
          {template.default_location ? ` · ${template.default_location}` : ""}
        </p>
        <p className="mt-1 text-[12px] text-muted-foreground">
          Open {template.default_check_in_open_offset_minutes} min · Close {template.default_check_in_close_offset_minutes} min
        </p>
      </button>
      <div className="absolute right-3 top-3">
        <ActionSheet
          trigger={
            <button
              type="button"
              aria-label="Template actions"
              className="ios-press flex h-9 w-9 items-center justify-center rounded-full bg-muted text-muted-foreground"
            >
              <MoreHorizontal className="h-5 w-5" />
            </button>
          }
          title={template.template_name}
          description="Template actions"
        >
          <ActionSheetItem icon={WandSparkles} label="Use template" onClick={() => onUse(template.id)} />
          <ActionSheetItem icon={Pencil} label="Edit template" onClick={() => onEdit(template)} />
          <ActionSheetItem icon={Copy} label="Duplicate" onClick={() => onDuplicate(template.id)} />
        </ActionSheet>
      </div>
    </div>
  );
}

function MetaPill({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-xl border border-primary/10 bg-secondary/75 px-4 py-3"><div className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</div><div className="mt-1 text-base font-semibold text-foreground">{value}</div></div>;
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

  return useCallback(
    async (_seed?: { fullName?: string; email?: string }) => {
      navigate({ to: "/home" });
    },
    [navigate],
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

// Club logo upload field — controlled by form state. Uploads the selected
// image to the private `host-logos` bucket under the host's own folder,
// and returns the storage path via onChange so the server function can
// persist it on the clubs row.
export function ClubLogoField({
  value,
  onChange,
  clubId,
  label = "Club logo",
  disabled,
}: {
  value: string | null | undefined;
  onChange: (path: string | null) => void;
  clubId?: string;
  label?: string;
  disabled?: boolean;
}) {
  const { user } = useAttendanceAuth();
  const previewUrl = useSignedLogoUrl(value ?? null);
  const [uploading, setUploading] = useState(false);
  const inputIdSuffix = useMemo(() => Math.random().toString(36).slice(2, 8), []);
  const inputId = `club-logo-${inputIdSuffix}`;

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !user) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file.");
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      toast.error("Logo must be 3MB or smaller.");
      return;
    }

    setUploading(true);
    const extension = file.name.split(".").pop()?.toLowerCase() || "png";
    const scope = clubId ? clubId : `draft-${Math.random().toString(36).slice(2, 10)}`;
    const filePath = `${user.id}/clubs/${scope}/logo-${Date.now()}.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from("host-logos")
      .upload(filePath, file, { upsert: true, cacheControl: "3600" });
    setUploading(false);
    if (uploadError) {
      toast.error("Unable to upload logo.");
      return;
    }
    onChange(filePath);
    toast.success("Logo uploaded.");
  }

  const hasLogo = Boolean(value);

  return (
    <div className="space-y-2">
      <Label className="text-sm font-semibold text-foreground">{label}</Label>
      <div className="flex items-center gap-4 rounded-xl border border-primary/10 bg-secondary/40 p-3">
        <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-brand text-primary-foreground shadow-[0_10px_24px_-18px_color-mix(in_oklab,var(--color-primary)_40%,transparent)]">
          {previewUrl ? (
            <img src={previewUrl} alt="Club logo preview" className="h-full w-full object-cover" />
          ) : (
            <ImagePlus className="h-6 w-6 opacity-90" />
          )}
          {uploading ? (
            <span className="absolute inset-0 flex items-center justify-center bg-foreground/25">
              <Loader2 className="h-5 w-5 animate-spin text-white" />
            </span>
          ) : null}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-sm text-muted-foreground">Square PNG or JPG, up to 3MB. Optional.</p>
          <div className="flex flex-wrap gap-2">
            <input
              id={inputId}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="sr-only"
              onChange={(nextEvent) => void handleFileChange(nextEvent)}
              disabled={disabled || uploading}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-full"
              onClick={() => document.getElementById(inputId)?.click()}
              disabled={disabled || uploading}
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
              {hasLogo ? "Replace" : "Upload logo"}
            </Button>
            {hasLogo ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="rounded-full text-destructive hover:text-destructive"
                onClick={() => onChange(null)}
                disabled={disabled || uploading}
              >
                <Trash2 className="h-4 w-4" />
                Remove
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

interface DialogBaseProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Reusable destructive confirm button with an AlertDialog + in-flight guard.
// Used for deleting clubs and events from every entry point (list cards,
// detail pages, edit dialogs) so the confirmation UX stays consistent.
export function DeleteConfirmButton({
  trigger,
  title,
  description,
  confirmLabel = "Delete",
  onConfirm,
}: {
  trigger: React.ReactNode;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  onConfirm: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleConfirm = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (deleting) return;
    setDeleting(true);
    try {
      await onConfirm();
      setOpen(false);
    } catch (deleteError) {
      toast.error(getManagementErrorMessage(deleteError, "Unable to delete."));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={(next) => { if (!deleting) setOpen(next); }}>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={deleting}
            onClick={handleConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleting ? "Deleting…" : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function ClubDialog({ open, onOpenChange, initialValues, onSubmit, onDelete, title, description, universities }: DialogBaseProps & { initialValues?: Partial<ClubUpdateValues> & { logoPath?: string | null }; onSubmit: (values: ClubCreateValues | ClubUpdateValues) => Promise<void>; onDelete?: () => Promise<void>; title: string; description: string; universities: University[] }) {
  const isEdit = Boolean(initialValues?.clubId);
  const form = useForm<ClubCreateValues | ClubUpdateValues>({
    resolver: zodResolver(isEdit ? clubUpdateSchema : clubSchema),
    defaultValues: isEdit
      ? { clubId: initialValues?.clubId ?? "", universityId: initialValues?.universityId ?? "", clubName: initialValues?.clubName ?? "", description: initialValues?.description ?? "", isActive: initialValues?.isActive ?? true, logoPath: initialValues?.logoPath ?? null }
      : { universityId: "", clubName: "", description: "", logoPath: null },
  });
  const [error, setError] = useState("");

  useEffect(() => {
    form.reset(isEdit
      ? { clubId: initialValues?.clubId ?? "", universityId: initialValues?.universityId ?? "", clubName: initialValues?.clubName ?? "", description: initialValues?.description ?? "", isActive: initialValues?.isActive ?? true, logoPath: initialValues?.logoPath ?? null }
      : { universityId: "", clubName: "", description: "", logoPath: null });
  }, [form, initialValues, isEdit, open]);

  const submit = form.handleSubmit(
    async (values) => {
      if (form.formState.isSubmitting) return;
      setError("");
      try {
        await onSubmit(values);
        onOpenChange(false);
      } catch (submitError) {
        const message = getManagementErrorMessage(submitError, "Unable to save club.");
        setError(message);
        toast.error(message);
      }
    },
    () => {
      setError("Please fix the highlighted fields before saving.");
    },
  );
  const isSubmitting = form.formState.isSubmitting;
  const hasUniversities = universities.length > 0;
  const clubFieldLabels: Record<string, string> = {
    universityId: "University",
    clubName: "Club name",
    description: "Description",
    logoPath: "Logo",
    isActive: "Active status",
  };
  const missingClubFields = Object.keys(form.formState.errors)
    .map((key) => clubFieldLabels[key] ?? key)
    .filter((label, index, all) => all.indexOf(label) === index);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto rounded-[2rem] border border-primary/10 bg-card/98 p-0 shadow-[0_28px_72px_-40px_color-mix(in_oklab,var(--color-primary)_24%,transparent)] sm:max-w-lg">
        <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-gradient-gold" />
        <DialogHeader>
          <div className="px-6 pt-3">
            <DialogTitle className="text-left font-display text-2xl font-extrabold text-foreground">{title}</DialogTitle>
            <DialogDescription className="mt-2 text-left text-sm leading-6 text-muted-foreground">{description}</DialogDescription>
          </div>
        </DialogHeader>
        <form className="space-y-4 px-6 pb-6 pt-2" onSubmit={(event) => void submit(event)}>
          <ClubLogoField
            value={(form.watch("logoPath") as string | null | undefined) ?? null}
            onChange={(path) => form.setValue("logoPath", path as never, { shouldDirty: true })}
            clubId={initialValues?.clubId}
          />
          {!isEdit && !hasUniversities ? (
            <div className="rounded-2xl border border-primary/15 bg-secondary/40 p-4 text-sm leading-6 text-muted-foreground">
              <p className="font-semibold text-foreground">Add a university first</p>
              <p className="mt-1">You'll need a university in your workspace before creating a club. Reach out to support to add one if you don't see it listed.</p>
            </div>
          ) : null}
          <SelectInput label="University" value={form.watch("universityId") as string} onValueChange={(value) => form.setValue("universityId", value as never, { shouldValidate: true })} placeholder={hasUniversities ? "Choose a university" : "No universities available"} options={universities.map((university) => ({ value: university.id, label: university.name }))} error={(form.formState.errors as Record<string, { message?: string } | undefined>).universityId?.message} disabled={!hasUniversities} />
          <TextInput label="Club name" error={form.formState.errors.clubName?.message} {...form.register("clubName")} />
          <TextAreaInput label="Description" error={form.formState.errors.description?.message} {...form.register("description")} />
          {isEdit ? (
            <div className="flex items-center justify-between rounded-xl border border-primary/10 bg-secondary/45 px-4 py-4">
              <div>
                <p className="text-sm font-medium text-foreground">Club active</p>
                <p className="text-sm text-muted-foreground">Hide inactive clubs from day-to-day management.</p>
              </div>
              <Switch checked={(form.watch("isActive") as boolean | undefined) ?? true} onCheckedChange={(checked) => form.setValue("isActive", checked as never)} />
            </div>
          ) : null}
          {missingClubFields.length > 0 ? (
            <div className="rounded-2xl bg-destructive/10 p-4 text-sm text-destructive" role="alert">
              <p className="font-semibold">Please fix the following before saving:</p>
              <ul className="mt-1 list-disc pl-5">
                {missingClubFields.map((label) => <li key={label}>{label}</li>)}
              </ul>
            </div>
          ) : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <PrimaryButton type="submit" className="w-full" disabled={isSubmitting || (!isEdit && !hasUniversities)}>{isSubmitting ? (isEdit ? "Saving…" : "Creating…") : (isEdit ? "Save Club" : "Create Club")}</PrimaryButton>
          {isEdit && onDelete ? (
            <DeleteConfirmButton
              trigger={
                <Button
                  type="button"
                  variant="outline"
                  className="h-12 w-full rounded-xl border-destructive/30 text-sm font-semibold text-destructive hover:bg-destructive/10 hover:text-destructive"
                  disabled={isSubmitting}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete Club
                </Button>
              }
              title="Delete this club?"
              description="This permanently removes the club, all of its events, attendance records, and templates. This cannot be undone."
              onConfirm={async () => {
                await onDelete();
                onOpenChange(false);
              }}
            />
          ) : null}
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

  const submit = form.handleSubmit(
    async (values) => {
      if (form.formState.isSubmitting) return;
      setError("");
      try {
        await onSubmit(values);
        onOpenChange(false);
      } catch (submitError) {
        const message = getManagementErrorMessage(submitError, "Unable to save template.");
        setError(message);
        toast.error(message);
      }
    },
    () => {
      setError("Please fix the highlighted fields before saving.");
    },
  );
  const isSubmitting = form.formState.isSubmitting;
  const templateFieldLabels: Record<string, string> = {
    templateName: "Template name",
    defaultEventName: "Default event name",
    defaultLocation: "Default location",
    defaultStartTime: "Default start time",
    defaultEndTime: "Default end time",
    defaultCheckInOpenOffsetMinutes: "Open offset minutes",
    defaultCheckInCloseOffsetMinutes: "Close offset minutes",
    clubId: "Club",
  };
  const missingTemplateFields = Object.keys(form.formState.errors)
    .map((key) => templateFieldLabels[key] ?? key)
    .filter((label, index, all) => all.indexOf(label) === index);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto rounded-[2rem] border border-primary/10 bg-card/98 p-0 shadow-[0_28px_72px_-40px_color-mix(in_oklab,var(--color-primary)_24%,transparent)] sm:max-w-lg">
        <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-gradient-gold" />
        <DialogHeader>
          <div className="px-6 pt-3">
            <DialogTitle className="text-left font-display text-2xl font-extrabold text-foreground">{isEdit ? "Edit Template" : "Create Template"}</DialogTitle>
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
          <PrimaryButton type="submit" className="w-full" disabled={isSubmitting}>{isSubmitting ? (isEdit ? "Saving…" : "Creating…") : (isEdit ? "Save Template" : "Create Template")}</PrimaryButton>
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
    <div className="space-y-2 rounded-xl border border-primary/10 bg-secondary/50 px-4 py-3">
      <p className="text-sm font-semibold text-foreground">{label}</p>
      <p className="text-sm text-muted-foreground">{formatted}</p>
    </div>
  );
}

function FormSection({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 rounded-[1.75rem] border border-primary/10 bg-surface/80 p-4 shadow-[0_18px_38px_-30px_color-mix(in_oklab,var(--color-primary)_16%,transparent)] sm:p-5">
      <div className="space-y-1">
        <h2 className="font-display text-base font-extrabold text-foreground sm:text-lg">{title}</h2>
        <p className="text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}

// Friendly labels for top-level EventForm fields. Used by the form-error
// summary banner so hosts see plain English next to each blocking message.
const EVENT_FIELD_LABELS: Record<string, string> = {
  clubId: "Club",
  eventName: "Event name",
  eventDate: "Event date",
  startTime: "Start time",
  endTime: "End time",
  location: "Location",
  checkInOpensAt: "Check-in opens",
  checkInClosesAt: "Check-in closes",
};

function EventFormErrorSummary({ errors }: { errors: Record<string, { message?: string } | undefined> }) {
  const entries = Object.entries(errors)
    .map(([field, value]) => ({ field, message: value?.message }))
    .filter((entry): entry is { field: string; message: string } => Boolean(entry.message));
  if (!entries.length) return null;
  return (
    <div role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4">
      <p className="text-sm font-semibold text-destructive">Fix these before saving</p>
      <ul className="mt-2 space-y-1 text-sm text-destructive">
        {entries.map((entry) => (
          <li key={entry.field}>
            <span className="font-medium">{EVENT_FIELD_LABELS[entry.field] ?? entry.field}:</span> {entry.message}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function EventForm({ payload, title, description, submitLabel, onSubmit, cancelAction, secondaryAction }: { payload: EventFormPayload; title: string; description: string; submitLabel: string; onSubmit: (values: EventValues | EventUpdateValues) => Promise<void>; cancelAction?: React.ReactNode; secondaryAction?: React.ReactNode }) {
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

  const submit = form.handleSubmit(
    async (values) => {
      if (form.formState.isSubmitting) return;
      setError("");
      try {
        await onSubmit(values);
      } catch (submitError) {
        setError(getManagementErrorMessage(submitError, "Unable to save event."));
      }
    },
    () => {
      setError("Some fields need attention — see highlighted errors above.");
    },
  );

  // Defensive: synchronously recompute hidden datetime fields from the latest
  // visible inputs before submission. The useEffect above can lag behind a
  // rapid Save click and leave checkInOpensAt / checkInClosesAt empty,
  // which would silently fail Zod validation.
  const handleSubmitClick = (event: React.FormEvent<HTMLFormElement>) => {
    const currentEventDate = form.getValues("eventDate");
    const currentStartTime = form.getValues("startTime");
    const currentEndTime = form.getValues("endTime");
    if (currentEventDate && currentStartTime && currentEndTime) {
      form.setValue(
        "checkInOpensAt",
        combineDateAndTime(currentEventDate, `${shiftTimeString(currentStartTime, -offsets.openMinutesBeforeStart)}:00`),
        { shouldValidate: false },
      );
      form.setValue(
        "checkInClosesAt",
        combineDateAndTime(currentEventDate, `${shiftTimeString(currentEndTime, offsets.closeMinutesAfterEnd)}:00`),
        { shouldValidate: false },
      );
    }
    void submit(event);
  };
  const isSubmitting = form.formState.isSubmitting;

  const selectedClubId = form.watch("clubId");
  const templatesForClub = useMemo(() => payload.templates.filter((template) => template.club_id === selectedClubId), [payload.templates, selectedClubId]);
  const selectedClub = useMemo(() => payload.clubs.find((club) => club.id === selectedClubId), [payload.clubs, selectedClubId]);
  const selectedUniversity = selectedClub?.universities?.name ?? "University needed";

  const cancelLink = cancelAction ?? (
    <Link to="/events" search={{ clubId: "", status: "all", query: "" }} className="text-[14px] font-semibold text-primary">
      Cancel
    </Link>
  );

  return (
    <ManagementPageShell hideTabBar>
      <LargeTitleHeader
        title={title}
        subtitle={description}
        trailing={
          <Link
            to="/events"
            search={{ clubId: "", status: "all", query: "" }}
            aria-label="Back to events"
            className="ios-press inline-flex h-10 w-10 items-center justify-center rounded-full bg-muted text-foreground"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
        }
      />

      <form className="space-y-5 pb-2" onSubmit={handleSubmitClick}>
        {templatesForClub.length ? (
          <div className="ios-card rounded-2xl p-4">
            <p className="text-[14px] font-semibold text-foreground">Start from template</p>
            <p className="mt-0.5 text-[12.5px] leading-snug text-muted-foreground">Use a recurring setup without rebuilding the form from scratch.</p>
            <div className="mt-3 -mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1">
              {templatesForClub.slice(0, 3).map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => navigate({ to: "/events/new", search: { clubId: selectedClubId || "", templateId: template.id, duplicateFrom: "" } })}
                  className="ios-press inline-flex min-w-fit shrink-0 snap-start items-center gap-1.5 rounded-full bg-muted px-3 py-2 text-[13px] font-semibold text-foreground"
                >
                  <WandSparkles className="h-4 w-4 text-primary" />
                  {template.template_name}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="ios-card rounded-2xl p-4">
          <div className="grid grid-cols-2 gap-3">
            <SummaryPill label="Club" value={selectedClub?.club_name ?? "—"} />
            <SummaryPill label="University" value={selectedUniversity} />
          </div>
          <div className="mt-3">
            <SummaryPill label="Check-in window" value={`-${offsets.openMinutesBeforeStart} / +${offsets.closeMinutesAfterEnd} min`} full />
          </div>
        </div>

        <FormSection title="Event basics" description="Name the meeting and attach it to the right club.">
          <SelectInput
            label="Club"
            value={form.watch("clubId")}
            onValueChange={(value) => form.setValue("clubId", value, { shouldValidate: true })}
            placeholder="Choose a club"
            options={payload.clubs.map((club) => ({ value: club.id, label: club.club_name }))}
            error={form.formState.errors.clubId?.message}
          />
          <TextInput label="Event name" error={form.formState.errors.eventName?.message} {...form.register("eventName")} />
          <DateInput label="Event date" error={form.formState.errors.eventDate?.message} {...form.register("eventDate")} />
          <TextInput label="Location" error={form.formState.errors.location?.message} {...form.register("location")} />
        </FormSection>

        <FormSection title="Schedule" description="Set the meeting window.">
          <TimeInput label="Start time" error={form.formState.errors.startTime?.message} {...form.register("startTime")} />
          <TimeInput label="End time" error={form.formState.errors.endTime?.message} {...form.register("endTime")} />
        </FormSection>

        <FormSection title="Check-in timing" description="Tune early access and post-event cleanup.">
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
          <input type="hidden" {...form.register("checkInOpensAt")} />
          <input type="hidden" {...form.register("checkInClosesAt")} />
          <DateTimeReadonly label="Check-in opens" value={form.watch("checkInOpensAt")} />
          <DateTimeReadonly label="Check-in closes" value={form.watch("checkInClosesAt")} />
        </FormSection>

        {form.formState.errors.checkInOpensAt?.message ? <p className="text-sm text-destructive">{form.formState.errors.checkInOpensAt.message}</p> : null}
        {form.formState.errors.checkInClosesAt?.message ? <p className="text-sm text-destructive">{form.formState.errors.checkInClosesAt.message}</p> : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <EventFormErrorSummary errors={form.formState.errors} />

        {secondaryAction ? <div className="flex justify-center pt-1">{secondaryAction}</div> : null}
        <div className="flex items-center justify-center gap-4 pt-1">
          {cancelLink}
        </div>

        <StickyCtaBar>
          <Button
            type="submit"
            disabled={isSubmitting}
            className="h-12 w-full rounded-2xl bg-primary text-[15px] font-bold text-primary-foreground"
          >
            {isSubmitting ? "Saving…" : submitLabel}
          </Button>
        </StickyCtaBar>
      </form>
    </ManagementPageShell>
  );
}

function SummaryPill({ label, value, full }: { label: string; value: string; full?: boolean }) {
  return (
    <div className={cn("rounded-xl bg-muted/70 px-3 py-2", full && "w-full")}>
      <div className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 truncate text-[13.5px] font-semibold text-foreground">{value}</div>
    </div>
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
