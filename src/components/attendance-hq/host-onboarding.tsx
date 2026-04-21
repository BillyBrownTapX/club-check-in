import * as React from "react";
import { Link } from "@tanstack/react-router";
import { CalendarDays, ChevronRight, Clock3, Copy, QrCode, Sparkles } from "lucide-react";
import QRCode from "react-qr-code";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { AttendanceLogo } from "@/components/attendance-hq/primitives";
import { formatEventDate, formatEventTime, formatTimestamp, type AttendanceRow, type EventWithClub } from "@/lib/attendance-hq";

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between py-2">
          <AttendanceLogo />
        </header>
        <main className="flex flex-1 items-center justify-center py-10 sm:py-14">{children}</main>
      </div>
    </div>
  );
}

export function AuthCard({ children }: { children: React.ReactNode }) {
  return <Card className="w-full max-w-[28rem] rounded-3xl border-border/70 shadow-sm"><CardContent className="space-y-6 p-6 sm:p-7">{children}</CardContent></Card>;
}

export function OnboardingShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen max-w-4xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        <header className="py-2"><AttendanceLogo /></header>
        <main className="flex flex-1 items-center justify-center py-8 sm:py-12">{children}</main>
      </div>
    </div>
  );
}

export function FormCard({ children }: { children: React.ReactNode }) {
  return <Card className="w-full max-w-[32rem] rounded-3xl border-border/70 shadow-sm"><CardContent className="space-y-6 p-6 sm:p-7">{children}</CardContent></Card>;
}

export function ProgressIndicator({ step, total, label }: { step: number; total: number; label: string }) {
  const progress = `${(step / total) * 100}%`;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-foreground">Step {step} of {total}</span>
        <span className="text-muted-foreground">{label}</span>
      </div>
      <div className="h-2 rounded-full bg-secondary">
        <div className="h-2 rounded-full bg-primary transition-all" style={{ width: progress }} />
      </div>
    </div>
  );
}

export function PageHeadingBlock({ eyebrow, title, description }: { eyebrow?: string; title: string; description: string }) {
  return (
    <div className="space-y-3">
      {eyebrow ? <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{eyebrow}</p> : null}
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">{title}</h1>
        <p className="max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">{description}</p>
      </div>
    </div>
  );
}

export function PrimaryButton(props: React.ComponentProps<typeof Button>) {
  return <Button {...props} className={cn("h-12 w-full rounded-2xl text-base font-semibold", props.className)} />;
}

export function SecondaryTextLink({ to, children, className }: { to: string; children: React.ReactNode; className?: string }) {
  return <Link to={to as never} className={cn("text-sm font-medium text-muted-foreground transition-colors hover:text-foreground", className)}>{children}</Link>;
}

export function InlineErrorMessage({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-sm font-medium text-destructive">{message}</p>;
}

function BaseInput({ label, error, render }: { label: string; error?: string; render: React.ReactNode }) {
  return (
    <div className="space-y-2.5">
      <Label className="text-sm font-semibold text-foreground">{label}</Label>
      {render}
      <InlineErrorMessage message={error} />
    </div>
  );
}

export function TextInput({ label, error, className, ...props }: React.ComponentProps<typeof Input> & { label: string; error?: string }) {
  return <BaseInput label={label} error={error} render={<Input {...props} className={cn("h-12 rounded-2xl border-border/80 bg-background px-4 text-base shadow-none", className)} />} />;
}

export function EmailInput(props: React.ComponentProps<typeof TextInput>) {
  return <TextInput type="email" autoComplete="email" {...props} />;
}

export function PasswordInput(props: React.ComponentProps<typeof TextInput>) {
  return <TextInput type="password" autoComplete="current-password" {...props} />;
}

export function DateInput(props: React.ComponentProps<typeof TextInput>) {
  return <TextInput type="date" {...props} />;
}

export function TimeInput(props: React.ComponentProps<typeof TextInput>) {
  return <TextInput type="time" {...props} />;
}

export function TextAreaField({ label, error, className, ...props }: React.ComponentProps<typeof Textarea> & { label: string; error?: string }) {
  return <BaseInput label={label} error={error} render={<Textarea {...props} className={cn("min-h-[112px] rounded-2xl border-border/80 bg-background px-4 py-3 text-base shadow-none", className)} />} />;
}

export function SuccessBanner({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-success/20 bg-success/10 px-4 py-3 text-sm text-foreground">
      <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-success" />
      <span>{message}</span>
    </div>
  );
}

export function AuthSupportLinks({ primary, secondary }: { primary: React.ReactNode; secondary?: React.ReactNode }) {
  return <div className="flex flex-col items-center gap-3 text-center">{primary}{secondary}</div>;
}

export function EventReadyCard({ event, attendance, successMessage, onCopyLink }: { event: EventWithClub; attendance: AttendanceRow[]; successMessage?: string; onCopyLink: () => void }) {
  const checkInUrl = typeof window === "undefined" ? `/check-in/${event.qr_token}` : `${window.location.origin}/check-in/${event.qr_token}`;

  return (
    <OnboardingShell>
      <div className="w-full max-w-5xl space-y-6">
        {successMessage ? <SuccessBanner message={successMessage} /> : null}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_22rem]">
          <Card className="rounded-3xl border-border/70 shadow-sm">
            <CardContent className="space-y-6 p-6 sm:p-7">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-2">
                  <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Event ready</p>
                  <h1 className="text-3xl font-semibold tracking-tight text-foreground">{event.event_name}</h1>
                  <p className="text-sm text-muted-foreground">{event.clubs?.club_name}</p>
                </div>
                <Button asChild variant="outline" className="h-11 rounded-2xl px-4">
                  <Link to="/check-in/$qrToken" params={{ qrToken: event.qr_token }} target="_blank">Open student check-in</Link>
                </Button>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <MetricCard icon={<CalendarDays className="h-4 w-4" />} label="Date" value={formatEventDate(event.event_date)} />
                <MetricCard icon={<Clock3 className="h-4 w-4" />} label="Time" value={formatEventTime(event.start_time, event.end_time)} />
                <MetricCard icon={<QrCode className="h-4 w-4" />} label="Attendance" value={`${attendance.length}`} />
              </div>

              <div className="rounded-3xl bg-secondary p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">QR-ready check-in link</p>
                    <p className="mt-1 break-all text-sm text-muted-foreground">{checkInUrl}</p>
                  </div>
                  <Button type="button" variant="outline" className="h-11 rounded-2xl px-4" onClick={onCopyLink}>
                    <Copy className="h-4 w-4" />
                    Copy link
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-foreground">Recent check-ins</h2>
                  <span className="text-sm text-muted-foreground">Live as students scan</span>
                </div>
                {attendance.length ? (
                  <div className="space-y-3">
                    {attendance.slice(0, 6).map((row) => (
                      <div key={row.id} className="flex items-start justify-between gap-4 rounded-2xl border border-border/70 bg-card px-4 py-3">
                        <div>
                          <p className="font-medium text-foreground">{row.students?.first_name} {row.students?.last_name}</p>
                          <p className="text-sm text-muted-foreground">{row.students?.student_email}</p>
                        </div>
                        <span className="shrink-0 text-sm text-muted-foreground">{formatTimestamp(row.checked_in_at)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-border px-4 py-5 text-sm text-muted-foreground">No one has checked in yet.</div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-border/70 shadow-sm">
            <CardHeader className="items-center p-6 pb-0 text-center">
              <CardTitle className="text-lg text-foreground">Display the QR code</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5 p-6 text-center">
              <div className="mx-auto w-full max-w-[18rem] rounded-3xl bg-white p-5">
                <QRCode value={checkInUrl} size={240} className="h-auto w-full" />
              </div>
              <p className="text-sm text-muted-foreground">Members can scan this to open the mobile check-in flow instantly.</p>
              <Button asChild className="h-12 rounded-2xl">
                <Link to="/check-in/$qrToken" params={{ qrToken: event.qr_token }} target="_blank">
                  Show student view
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </OnboardingShell>
  );
}

function MetricCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-secondary px-4 py-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">{icon}<span>{label}</span></div>
      <p className="mt-2 text-base font-semibold text-foreground">{value}</p>
    </div>
  );
}
