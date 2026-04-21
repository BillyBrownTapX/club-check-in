import { useEffect, useId, useState, type ChangeEvent } from "react";
import { Link } from "@tanstack/react-router";
import { CalendarDays, Clock3, ImagePlus, Loader2, MapPin, QrCode, ShieldCheck, Users, Zap } from "lucide-react";
import { useAttendanceAuth } from "@/components/attendance-hq/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  formatEventDate,
  formatEventTime,
  formatTimestamp,
  getCheckInStatus,
  maskEmail,
  type AttendanceRow,
  type CheckInStatus,
  type Club,
  type EventSummary,
  type EventTemplateWithClub,
  type EventWithClub,
  type Student,
} from "@/lib/attendance-hq";

const statusMap: Record<CheckInStatus, { label: string; className: string }> = {
  open: { label: "Check-in open", className: "bg-primary/12 text-primary border border-primary/15" },
  upcoming: { label: "Opens soon", className: "bg-accent/18 text-accent-foreground border border-accent/30" },
  closed: { label: "Closed", className: "bg-muted text-muted-foreground border border-border/70" },
  inactive: { label: "Closed early", className: "bg-destructive/10 text-destructive border border-destructive/20" },
  archived: { label: "Archived", className: "bg-muted text-muted-foreground border border-border/70" },
};

export function AttendanceLogo({ compact = false }: { compact?: boolean }) {
  const { user } = useAttendanceAuth();
  const inputId = useId();
  const [logoSrc, setLogoSrc] = useState<string | null>(null);
  const [loadingLogo, setLoadingLogo] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadLogo() {
      if (!user) {
        if (!active) return;
        setLogoSrc(null);
        return;
      }

      setLoadingLogo(true);
      const { data, error } = await supabase.from("host_profiles").select("logo_url").eq("id", user.id).maybeSingle();
      if (!active) return;
      if (error || !data?.logo_url) {
        setLogoSrc(null);
        setLoadingLogo(false);
        return;
      }

      const { data: signed, error: signedError } = await supabase.storage.from("host-logos").createSignedUrl(data.logo_url, 60 * 60);
      if (!active) return;
      setLogoSrc(signedError ? null : signed.signedUrl);
      setLoadingLogo(false);
    }

    void loadLogo();
    return () => {
      active = false;
    };
  }, [user]);

  async function handleLogoUpload(event: ChangeEvent<HTMLInputElement>) {
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
    const filePath = `${user.id}/logo-${Date.now()}.${extension}`;
    const { error: uploadError } = await supabase.storage.from("host-logos").upload(filePath, file, { upsert: true, cacheControl: "3600" });
    if (uploadError) {
      setUploading(false);
      toast.error("Unable to upload logo.");
      return;
    }

    const { error: profileError } = await supabase.from("host_profiles").update({ logo_url: filePath }).eq("id", user.id);
    if (profileError) {
      setUploading(false);
      toast.error("Logo uploaded, but we couldn't save it to your profile.");
      return;
    }

    const { data: signed } = await supabase.storage.from("host-logos").createSignedUrl(filePath, 60 * 60);
    setLogoSrc(signed?.signedUrl ?? null);
    setUploading(false);
    toast.success("Logo updated.");
  }

  const badge = (
    <label
      htmlFor={user ? inputId : undefined}
      className={cn(
        "group relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/20 bg-gradient-brand text-primary-foreground shadow-[0_18px_38px_-22px_color-mix(in_oklab,var(--color-primary)_42%,transparent)]",
        user ? "cursor-pointer" : "",
      )}
      aria-label={user ? "Upload logo" : "Attendance HQ logo"}
    >
      {logoSrc ? <img src={logoSrc} alt="Uploaded organization logo" className="h-full w-full object-cover" /> : <QrCode className={cn("h-5 w-5 transition-opacity", user ? "group-hover:opacity-0" : "")} />}
      {user ? (
        <>
          <input id={inputId} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="sr-only" onChange={(nextEvent) => void handleLogoUpload(nextEvent)} disabled={uploading} />
          <span className="absolute inset-0 flex items-center justify-center bg-foreground/12 opacity-0 transition-opacity group-hover:opacity-100">
            {uploading || loadingLogo ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
          </span>
        </>
      ) : null}
    </label>
  );

  return (
    <div className="inline-flex items-center gap-3">
      {badge}
      {!compact ? (
        <Link to="/" className="flex flex-col leading-none">
          <span className="font-display text-base font-extrabold text-foreground">Attendance HQ</span>
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/70">UNG event check-in</span>
        </Link>
      ) : null}
    </div>
  );
}

export function StatusBadge({ status }: { status: CheckInStatus }) {
  const config = statusMap[status];
  return <span className={cn("inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold", config.className)}>{config.label}</span>;
}

export function PublicPageShell({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-background"><div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 py-6 sm:px-6 sm:py-10">{children}</div></div>;
}

export function EventInfoCard({ event }: { event: EventWithClub | EventSummary }) {
  const status = getCheckInStatus(event);
  return (
    <Card className="overflow-hidden rounded-[1.75rem] border border-primary/10 bg-card shadow-[0_24px_60px_-34px_color-mix(in_oklab,var(--color-primary)_26%,transparent)]">
      <div className="h-1.5 bg-gradient-brand" />
      <CardHeader className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <CardDescription className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/75">{event.clubs?.club_name ?? "Club event"}</CardDescription>
            <CardTitle className="font-display text-2xl font-extrabold leading-tight text-foreground">{event.event_name}</CardTitle>
          </div>
          <StatusBadge status={status} />
        </div>
        <div className="grid gap-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-primary" />{formatEventDate(event.event_date)}</div>
          <div className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-primary" />{formatEventTime(event.start_time, event.end_time)}</div>
          {event.location ? <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" />{event.location}</div> : null}
        </div>
      </CardHeader>
    </Card>
  );
}

export function ActionChoiceCard({ title, description, action, icon, to, params }: { title: string; description: string; action: string; icon: React.ReactNode; to?: string; params?: Record<string, string>; }) {
  const content = (
    <Card className="rounded-[1.5rem] border border-primary/10 bg-card shadow-[0_18px_44px_-30px_color-mix(in_oklab,var(--color-primary)_22%,transparent)] transition-transform duration-150 hover:-translate-y-0.5 hover:shadow-[0_20px_48px_-28px_color-mix(in_oklab,var(--color-primary)_26%,transparent)]">
      <CardContent className="flex items-center gap-4 p-5">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary text-secondary-foreground">{icon}</div>
        <div className="min-w-0 flex-1">
          <div className="font-display text-base font-bold text-foreground">{title}</div>
          <div className="mt-1 text-sm text-muted-foreground">{description}</div>
        </div>
        <div className="text-sm font-semibold text-gradient-gold">{action}</div>
      </CardContent>
    </Card>
  );

  return to ? <Link to={to as never} params={params as never} className="block">{content}</Link> : content;
}

export function SuccessStateCard({ event, checkedInAt }: { event: EventWithClub; checkedInAt: string }) {
  return (
    <Card className="rounded-[2rem] border border-success/20 bg-card shadow-[0_22px_54px_-30px_color-mix(in_oklab,var(--color-success)_26%,transparent)]">
      <CardContent className="space-y-6 p-6 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success/12 text-success ring-gold">
          <ShieldCheck className="h-8 w-8" />
        </div>
        <div className="space-y-2">
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground">You’re checked in</h1>
          <p className="text-sm text-muted-foreground">Your attendance has been recorded successfully.</p>
        </div>
        <div className="rounded-[1.5rem] surface-soft p-4 text-left">
          <div className="text-sm font-semibold uppercase tracking-[0.14em] text-primary/75">{event.clubs?.club_name}</div>
          <div className="mt-1 font-display text-xl font-bold text-foreground">{event.event_name}</div>
          <div className="mt-3 space-y-1 text-sm text-muted-foreground">
            <div>{formatEventDate(event.event_date)}</div>
            <div>Checked in {formatTimestamp(checkedInAt)}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function ErrorStateCard({ title, description, actionLabel, actionTo }: { title: string; description: string; actionLabel?: string; actionTo?: string; }) {
  return (
    <Card className="rounded-[2rem] border border-primary/10 bg-card shadow-[0_18px_42px_-28px_color-mix(in_oklab,var(--color-primary)_18%,transparent)]">
      <CardContent className="space-y-5 p-6 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <div className="space-y-2">
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {actionLabel && actionTo ? <Button asChild variant="hero" className="w-full"><Link to={actionTo as never}>{actionLabel}</Link></Button> : null}
      </CardContent>
    </Card>
  );
}

export function IdentityConfirmationCard({ student }: { student: Pick<Student, "first_name" | "last_name" | "student_email"> }) {
  return (
    <Card className="rounded-[2rem] border border-primary/10 bg-card shadow-[0_18px_42px_-28px_color-mix(in_oklab,var(--color-primary)_18%,transparent)]">
      <CardContent className="space-y-4 p-6 text-center">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/70">Student found</div>
        <div>
          <div className="font-display text-2xl font-extrabold text-foreground">{student.first_name} {student.last_name.charAt(0).toUpperCase()}.</div>
          <div className="mt-2 text-sm text-muted-foreground">{maskEmail(student.student_email)}</div>
        </div>
      </CardContent>
    </Card>
  );
}

export function PageHeader({ title, description, action }: { title: string; description?: string; action?: React.ReactNode; }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/70">Attendance HQ</p>
        <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-foreground">{title}</h1>
        {description ? <p className="mt-2 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function KPIStatCard({ label, value, hint, icon }: { label: string; value: string | number; hint: string; icon: React.ReactNode; }) {
  return (
    <Card className="rounded-[1.5rem] border border-primary/10 bg-card shadow-[0_18px_42px_-30px_color-mix(in_oklab,var(--color-primary)_20%,transparent)]">
      <CardContent className="flex items-start justify-between gap-4 p-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary/70">{label}</p>
          <p className="mt-2 font-display text-3xl font-extrabold tracking-tight text-foreground">{value}</p>
          <p className="mt-2 text-sm text-muted-foreground">{hint}</p>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-secondary text-secondary-foreground">{icon}</div>
      </CardContent>
    </Card>
  );
}

export function ClubCard({ club, upcomingEvents = 0, pastEvents = 0 }: { club: Club; upcomingEvents?: number; pastEvents?: number; }) {
  return (
    <Card className="rounded-[1.6rem] border border-primary/10 bg-card shadow-[0_18px_44px_-30px_color-mix(in_oklab,var(--color-primary)_22%,transparent)]">
      <CardContent className="space-y-4 p-5">
        <div className="space-y-1">
          <div className="font-display text-xl font-bold text-foreground">{club.club_name}</div>
          <div className="text-sm text-muted-foreground">{club.description || "No club description yet."}</div>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl surface-soft p-3"><div className="text-primary/70">Upcoming</div><div className="mt-1 font-display text-lg font-bold text-foreground">{upcomingEvents}</div></div>
          <div className="rounded-xl surface-cream p-3"><div className="text-primary/70">Past</div><div className="mt-1 font-display text-lg font-bold text-foreground">{pastEvents}</div></div>
        </div>
        <Button asChild variant="outline" className="w-full"><Link to="/clubs/$clubId" params={{ clubId: club.id }}>Manage club</Link></Button>
      </CardContent>
    </Card>
  );
}

export function EventCard({ event, actionLabel = "Manage" }: { event: EventSummary; actionLabel?: string; }) {
  return (
    <Card className="rounded-[1.6rem] border border-primary/10 bg-card shadow-[0_18px_44px_-30px_color-mix(in_oklab,var(--color-primary)_22%,transparent)]">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="font-display text-lg font-bold text-foreground">{event.event_name}</div>
            <div className="mt-1 text-sm text-muted-foreground">{event.clubs?.club_name}</div>
          </div>
          <StatusBadge status={getCheckInStatus(event)} />
        </div>
        <div className="space-y-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-primary" />{formatEventDate(event.event_date)}</div>
          <div className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-primary" />{formatEventTime(event.start_time, event.end_time)}</div>
          {event.location ? <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" />{event.location}</div> : null}
        </div>
        <div className="flex items-center justify-between rounded-xl surface-soft px-4 py-3 text-sm">
          <span className="text-muted-foreground">Attendance</span>
          <span className="font-display text-base font-bold text-foreground">{event.attendance_records?.length ?? 0}</span>
        </div>
        <Button asChild variant="default" className="w-full"><Link to="/events/$eventId" params={{ eventId: event.id }} search={{ created: "" }}>{actionLabel}</Link></Button>
      </CardContent>
    </Card>
  );
}

export function TemplateCard({ template }: { template: EventTemplateWithClub }) {
  return (
    <Card className="rounded-[1.6rem] border border-primary/10 bg-card shadow-[0_18px_44px_-30px_color-mix(in_oklab,var(--color-primary)_22%,transparent)]">
      <CardContent className="space-y-4 p-5">
        <div>
          <div className="font-display text-base font-bold text-foreground">{template.template_name}</div>
          <div className="mt-1 text-sm text-muted-foreground">{template.default_location || "Location not set"}</div>
        </div>
        <div className="grid gap-2 text-sm text-muted-foreground">
          <div>Default time: {template.default_start_time && template.default_end_time ? formatEventTime(template.default_start_time, template.default_end_time) : "Not set"}</div>
          <div>Open/close offsets: {template.default_check_in_open_offset_minutes} / {template.default_check_in_close_offset_minutes} min</div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Button variant="outline">Use</Button>
          <Button variant="outline">Edit</Button>
          <Button variant="outline">Duplicate</Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function AttendanceSummaryCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode; }) {
  return (
    <Card className="rounded-[1.5rem] border border-primary/10 bg-card shadow-[0_18px_42px_-30px_color-mix(in_oklab,var(--color-primary)_20%,transparent)]">
      <CardContent className="flex items-center justify-between gap-4 p-5">
        <div>
          <div className="text-sm text-muted-foreground">{label}</div>
          <div className="mt-2 font-display text-2xl font-bold text-foreground">{value}</div>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-secondary text-secondary-foreground">{icon}</div>
      </CardContent>
    </Card>
  );
}

export function AttendeeRowCard({ row }: { row: AttendanceRow }) {
  return (
    <div className="rounded-2xl border border-primary/10 bg-card p-4 shadow-[0_14px_34px_-24px_color-mix(in_oklab,var(--color-primary)_18%,transparent)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-foreground">{row.students?.first_name} {row.students?.last_name}</div>
          <div className="mt-1 text-sm text-muted-foreground">{row.students?.student_email}</div>
          <div className="mt-1 text-sm text-muted-foreground">900 #{row.students?.nine_hundred_number}</div>
        </div>
        <div className="text-right text-sm text-muted-foreground">{formatTimestamp(row.checked_in_at)}</div>
      </div>
    </div>
  );
}

export function EmptyStateBlock({ title, description, action }: { title: string; description: string; action?: React.ReactNode; }) {
  return (
    <Card className="rounded-[1.6rem] border border-dashed border-primary/15 bg-card shadow-none">
      <CardContent className="flex flex-col items-center justify-center gap-3 p-8 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary text-secondary-foreground"><Users className="h-6 w-6" /></div>
        <div>
          <div className="font-display text-lg font-bold text-foreground">{title}</div>
          <div className="mt-1 text-sm text-muted-foreground">{description}</div>
        </div>
        {action}
      </CardContent>
    </Card>
  );
}

export function LandingHighlights() {
  const items = [
    { title: "Faster than paper sign-ins", description: "Move students through the line with a clean mobile flow.", icon: <Zap className="h-5 w-5" /> },
    { title: "Live attendance records", description: "Track every check-in instantly while the event is happening.", icon: <Users className="h-5 w-5" /> },
    { title: "Cleaner club operations", description: "Keep events, QR links, and exports organized in one place.", icon: <ShieldCheck className="h-5 w-5" /> },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {items.map((item) => (
        <Card key={item.title} className="rounded-[1.6rem] border border-primary/10 bg-card shadow-[0_18px_44px_-30px_color-mix(in_oklab,var(--color-primary)_18%,transparent)]">
          <CardContent className="space-y-3 p-5">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-secondary text-secondary-foreground">{item.icon}</div>
            <div>
              <div className="font-display text-lg font-bold text-foreground">{item.title}</div>
              <div className="mt-1 text-sm text-muted-foreground">{item.description}</div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
