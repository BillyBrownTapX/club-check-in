import type { ReactNode } from "react";
import { CheckCircle2, ChevronRight, Clock3, MapPin, QrCode, ShieldAlert, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  formatEventDate,
  formatEventTime,
  formatTimestamp,
  getStudentShortName,
  type CheckInStatus,
  type EventWithClub,
  type PublicStudentPreview,
} from "@/lib/attendance-hq";

const statusLabelMap: Record<CheckInStatus, string> = {
  open: "Check-in Open",
  upcoming: "Not Open Yet",
  closed: "Closed",
  inactive: "Closed",
  archived: "Closed",
};

const statusToneMap: Record<CheckInStatus, string> = {
  open: "bg-primary/12 text-primary border border-primary/15",
  upcoming: "bg-accent/18 text-accent-foreground border border-accent/30",
  closed: "bg-muted text-muted-foreground border border-border/70",
  inactive: "bg-destructive/10 text-destructive border border-destructive/20",
  archived: "bg-muted text-muted-foreground border border-border/70",
};

export function PublicCheckInShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-app-shell">
      <div className="blur-orb-white left-0 top-0 h-32 w-32" />
      <div className="blur-orb-blue -right-8 top-10 h-40 w-40" />
      <div className="mx-auto flex min-h-screen w-full max-w-[29rem] flex-col px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] sm:px-6 sm:pt-8">
        <div className="mb-5 flex items-center gap-3 px-1">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-brand text-primary-foreground shadow-[0_18px_36px_-20px_color-mix(in_oklab,var(--color-primary)_40%,transparent)]">
            <QrCode className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-primary/70">Attendance HQ</div>
            <div className="font-display text-base font-extrabold text-foreground">Student check-in</div>
          </div>
        </div>
        <div className="flex-1 space-y-4">{children}</div>
      </div>
    </div>
  );
}

export function StatusBadge({ status }: { status: CheckInStatus }) {
  return <span className={cn("inline-flex rounded-full px-3 py-1 text-xs font-semibold", statusToneMap[status])}>{statusLabelMap[status]}</span>;
}

export function EventInfoCard({ event, status }: { event: EventWithClub; status: CheckInStatus }) {
  return (
    <Card className="overflow-hidden rounded-[2rem] border border-primary/10 bg-card/95 shadow-[0_24px_56px_-34px_color-mix(in_oklab,var(--color-primary)_24%,transparent)]">
      <div className="hero-wash px-5 py-5 text-white">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-white/80">{event.clubs?.club_name ?? "Club event"}</div>
            <CardTitle className="mt-2 font-display text-[1.8rem] font-extrabold leading-tight text-white">{event.event_name}</CardTitle>
          </div>
          <StatusBadge status={status} />
        </div>
      </div>
      <CardHeader className="space-y-3 p-5">
        <div className="space-y-3 text-sm text-muted-foreground">
          <div>{formatEventDate(event.event_date)}</div>
          <div className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-primary" />{formatEventTime(event.start_time, event.end_time)}</div>
          {event.location ? <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" />{event.location}</div> : null}
        </div>
      </CardHeader>
    </Card>
  );
}

export function ActionChoiceCard({ title, description, icon, onClick }: { title: string; description?: string; icon: ReactNode; onClick: () => void; }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-4 rounded-[1.75rem] border border-primary/10 bg-card/95 p-5 text-left shadow-[0_20px_44px_-28px_color-mix(in_oklab,var(--color-primary)_20%,transparent)] transition-transform duration-150 hover:-translate-y-0.5"
    >
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-secondary text-secondary-foreground">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="font-display text-base font-bold text-foreground">{title}</div>
        {description ? <div className="mt-1 text-sm text-muted-foreground">{description}</div> : null}
      </div>
      <ChevronRight className="h-5 w-5 text-muted-foreground" />
    </button>
  );
}

export function CheckInFormCard({ children }: { children: ReactNode }) {
  return <Card className="rounded-[2rem] border border-primary/10 bg-card/95 shadow-[0_24px_56px_-34px_color-mix(in_oklab,var(--color-primary)_24%,transparent)]"><CardContent className="space-y-4 p-5 pt-5">{children}</CardContent></Card>;
}

export function IdentityConfirmationCard({ student }: { student: PublicStudentPreview }) {
  return (
    <Card className="rounded-[2rem] border border-primary/10 bg-card/95 shadow-[0_18px_42px_-28px_color-mix(in_oklab,var(--color-primary)_18%,transparent)]">
      <CardContent className="space-y-4 p-6 text-center">
        <div className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-primary/70">Student found</div>
        <div className="space-y-2">
          <div className="font-display text-2xl font-extrabold text-foreground">{student.firstName} {student.lastInitial}.</div>
          <div className="text-sm text-muted-foreground">{student.maskedEmail}</div>
        </div>
      </CardContent>
    </Card>
  );
}

export function SuccessStateCard({ event, checkedInAt }: { event: EventWithClub; checkedInAt: string }) {
  return (
    <Card className="rounded-[2rem] border border-success/20 bg-card/95 shadow-[0_18px_42px_-28px_color-mix(in_oklab,var(--color-success)_20%,transparent)]">
      <CardContent className="space-y-5 p-6 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success/12 text-success ring-gold">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <div className="space-y-2">
          <h1 className="font-display text-3xl font-extrabold text-foreground">You’re checked in</h1>
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

export function ErrorStateCard({ title, description, marker = <ShieldAlert className="h-7 w-7" />, action }: { title: string; description: string; marker?: ReactNode; action?: ReactNode; }) {
  return (
    <Card className="rounded-[2rem] border border-primary/10 bg-card/95 shadow-[0_18px_42px_-28px_color-mix(in_oklab,var(--color-primary)_18%,transparent)]">
      <CardContent className="space-y-5 p-6 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">{marker}</div>
        <div className="space-y-2">
          <h1 className="font-display text-2xl font-bold text-foreground">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {action}
      </CardContent>
    </Card>
  );
}

export function PrimaryButton(props: React.ComponentProps<typeof Button>) {
  return <Button {...props} variant={props.variant ?? "hero"} className={cn("h-13 w-full rounded-xl text-base font-bold", props.className)} />;
}

export function SecondaryTextButton(props: React.ComponentProps<typeof Button>) {
  return <Button variant="ghost" {...props} className={cn("h-11 w-full rounded-xl text-sm font-semibold text-primary", props.className)} />;
}

export function MobileInputField({ label, error, className, ...props }: React.ComponentProps<typeof Input> & { label: string; error?: string; }) {
  return (
    <div className="space-y-2.5">
      <Label className="text-sm font-semibold text-foreground">{label}</Label>
      <Input {...props} className={cn("h-13 rounded-xl border-primary/10 bg-background px-4 text-base shadow-none placeholder:text-muted-foreground/90", className)} />
      {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}
    </div>
  );
}

export function MobileNumericField(props: React.ComponentProps<typeof MobileInputField>) {
  return <MobileInputField inputMode="numeric" pattern="[0-9]*" autoComplete="off" {...props} />;
}

export function EventContextRow({ event }: { event: EventWithClub }) {
  return <div className="px-1 text-sm font-medium text-primary/75">{event.clubs?.club_name} • {event.event_name}</div>;
}

export function RememberedStudentLabel({ student }: { student: PublicStudentPreview }) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Sparkles className="h-4 w-4 text-accent" />
      <span>Check in as {getStudentShortName({ first_name: student.firstName, last_name: student.lastInitial })}</span>
    </div>
  );
}
