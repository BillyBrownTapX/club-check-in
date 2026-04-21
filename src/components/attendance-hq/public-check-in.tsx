import type { ReactNode } from "react";
import { Clock3, MapPin, QrCode, ShieldAlert, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandMark, Chip, SuccessBurst } from "@/components/attendance-hq/ios";
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
  open: "Open",
  upcoming: "Opens soon",
  closed: "Closed",
  inactive: "Closed",
  archived: "Closed",
};

const statusToneMap: Record<CheckInStatus, "success" | "gold" | "muted" | "destructive"> = {
  open: "success",
  upcoming: "gold",
  closed: "muted",
  inactive: "destructive",
  archived: "muted",
};

export function PublicCheckInShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="blur-orb-blue -left-10 -top-10 h-36 w-36 opacity-40" />
      <div className="blur-orb-gold -bottom-12 -right-8 h-40 w-40 opacity-40" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-[440px] flex-col px-4 pb-safe pt-safe-1 sm:px-5">
        <header className="flex items-center justify-between py-3">
          <BrandMark size="sm" />
          <Chip tone="muted">Check-in</Chip>
        </header>
        <main className="flex-1 space-y-4 pb-6">{children}</main>
      </div>
    </div>
  );
}

export function StatusBadge({ status }: { status: CheckInStatus }) {
  return <Chip tone={statusToneMap[status]}>{statusLabelMap[status]}</Chip>;
}

export function EventInfoCard({ event, status }: { event: EventWithClub; status: CheckInStatus }) {
  return (
    <div className="relative overflow-hidden rounded-[1.75rem] hero-wash p-5 text-white ios-spring-in">
      <div className="blur-orb-gold -bottom-8 -right-6 h-28 w-28 opacity-60" />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/80">{event.clubs?.club_name ?? "Club event"}</p>
          <h2 className="mt-2 font-display text-[24px] font-extrabold leading-tight">{event.event_name}</h2>
        </div>
        <StatusBadge status={status} />
      </div>
      <div className="relative mt-4 space-y-1.5 text-[13px] text-white/90">
        <div>{formatEventDate(event.event_date)}</div>
        <div className="flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5" />{formatEventTime(event.start_time, event.end_time)}</div>
        {event.location ? <div className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{event.location}</div> : null}
      </div>
    </div>
  );
}

export function CheckInFormCard({ children }: { children: ReactNode }) {
  return <div className="ios-card rounded-[1.5rem] p-5 space-y-4 ios-spring-in">{children}</div>;
}

export function IdentityConfirmationCard({ student }: { student: PublicStudentPreview }) {
  return (
    <div className="ios-card rounded-[1.5rem] p-6 text-center ios-spring-in">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <QrCode className="h-5 w-5" />
      </div>
      <p className="mt-4 ios-section-label">Student found</p>
      <p className="mt-2 font-display text-[24px] font-extrabold text-foreground">{student.firstName} {student.lastInitial}.</p>
      <p className="mt-1 text-[13px] text-muted-foreground">{student.maskedEmail}</p>
    </div>
  );
}

export function SuccessStateCard({ event, checkedInAt }: { event: EventWithClub; checkedInAt: string }) {
  return (
    <div className="ios-card rounded-[1.75rem] p-6 text-center ios-spring-in">
      <SuccessBurst />
      <h1 className="mt-5 font-display text-[28px] font-extrabold text-foreground">You're checked in</h1>
      <p className="mt-1.5 text-[14px] text-muted-foreground">Your attendance has been recorded.</p>
      <div className="mt-5 rounded-2xl bg-muted px-4 py-4 text-left">
        <p className="ios-section-label">{event.clubs?.club_name}</p>
        <p className="mt-1 font-display text-[17px] font-bold text-foreground">{event.event_name}</p>
        <p className="mt-2 text-[13px] text-muted-foreground">{formatEventDate(event.event_date)}</p>
        <p className="mt-1 text-[13px] text-muted-foreground">Checked in {formatTimestamp(checkedInAt)}</p>
      </div>
    </div>
  );
}

export function ErrorStateCard({ title, description, marker, action }: { title: string; description: string; marker?: ReactNode; action?: ReactNode }) {
  return (
    <div className="ios-card rounded-[1.75rem] p-6 text-center ios-spring-in">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        {marker ?? <ShieldAlert className="h-5 w-5" />}
      </div>
      <h1 className="mt-4 font-display text-[22px] font-bold text-foreground">{title}</h1>
      <p className="mt-1.5 text-[14px] leading-6 text-muted-foreground">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function PrimaryButton(props: React.ComponentProps<typeof Button>) {
  return <Button {...props} variant={props.variant ?? "hero"} size={props.size ?? "xl"} className={cn("w-full", props.className)} />;
}

export function SecondaryTextButton(props: React.ComponentProps<typeof Button>) {
  return <Button variant="ghost" {...props} className={cn("h-11 w-full rounded-xl text-[14px] font-semibold text-primary", props.className)} />;
}

export function MobileInputField({ label, error, className, ...props }: React.ComponentProps<typeof Input> & { label: string; error?: string }) {
  return (
    <div className="space-y-2">
      <Label className="text-[13px] font-semibold text-foreground">{label}</Label>
      <Input {...props} className={cn("h-12 rounded-xl border-border/80 bg-muted/50 px-4 text-[15px] shadow-none focus-visible:bg-card", className)} />
      {error ? <p className="text-[13px] font-medium text-destructive">{error}</p> : null}
    </div>
  );
}

export function MobileNumericField(props: React.ComponentProps<typeof MobileInputField>) {
  return <MobileInputField inputMode="numeric" pattern="[0-9]*" autoComplete="off" {...props} />;
}

export function EventContextRow({ event }: { event: EventWithClub }) {
  return <p className="px-1 text-[13px] font-medium text-muted-foreground">{event.clubs?.club_name} · {event.event_name}</p>;
}

export function RememberedStudentLabel({ student }: { student: PublicStudentPreview }) {
  return (
    <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
      <Sparkles className="h-4 w-4 text-accent" />
      <span>Check in as {getStudentShortName({ first_name: student.firstName, last_name: student.lastInitial })}</span>
    </div>
  );
}
