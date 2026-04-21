import * as React from "react";
import { Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { AttendanceLogo } from "@/components/attendance-hq/primitives";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

function ShellBackdrop({ children, narrow = false }: { children: React.ReactNode; narrow?: boolean }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-app-shell">
      <div className="blur-orb-white -left-10 top-8 h-36 w-36" />
      <div className="blur-orb-blue right-0 top-0 h-44 w-44" />
      <div className={cn("relative mx-auto flex min-h-screen flex-col px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] sm:px-6", narrow ? "max-w-4xl" : "max-w-6xl")}>{children}</div>
    </div>
  );
}

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <ShellBackdrop>
      <header className="flex items-center justify-between py-4">
        <AttendanceLogo />
      </header>
      <main className="flex flex-1 items-center justify-center py-8 sm:py-14">{children}</main>
    </ShellBackdrop>
  );
}

export function AuthCard({ children }: { children: React.ReactNode }) {
  return (
    <Card className="w-full max-w-[30rem] overflow-hidden rounded-[2rem] border border-primary/10 bg-card/95 shadow-[0_32px_80px_-38px_color-mix(in_oklab,var(--color-primary)_30%,transparent)]">
      <div className="h-1.5 bg-gradient-brand" />
      <CardContent className="space-y-6 p-6 pb-8 sm:p-7 sm:pb-9">{children}</CardContent>
    </Card>
  );
}

export function OnboardingShell({ children }: { children: React.ReactNode }) {
  return (
    <ShellBackdrop narrow>
      <header className="py-3"><AttendanceLogo /></header>
      <main className="flex flex-1 items-center justify-center py-6 sm:py-12">{children}</main>
    </ShellBackdrop>
  );
}

export function FormCard({ children }: { children: React.ReactNode }) {
  return (
    <Card className="w-full max-w-[36rem] overflow-hidden rounded-[2rem] border border-primary/10 bg-card/95 shadow-[0_32px_80px_-38px_color-mix(in_oklab,var(--color-primary)_30%,transparent)]">
      <div className="h-1.5 bg-gradient-brand" />
      <CardContent className="space-y-6 p-6 pb-8 sm:p-7 sm:pb-9">{children}</CardContent>
    </Card>
  );
}

export function ProgressIndicator({ step, total, label }: { step: number; total: number; label: string }) {
  const progress = `${(step / total) * 100}%`;
  return (
    <div className="space-y-3 rounded-[1.4rem] surface-soft px-4 py-4">
      <div className="flex items-center justify-between text-sm">
        <span className="font-semibold text-foreground">Step {step} of {total}</span>
        <span className="text-muted-foreground">{label}</span>
      </div>
      <div className="h-2.5 rounded-full bg-white/70">
        <div className="h-2.5 rounded-full bg-gradient-gold transition-all" style={{ width: progress }} />
      </div>
    </div>
  );
}

export function PageHeadingBlock({ eyebrow, title, description }: { eyebrow?: string; title: string; description: string }) {
  return (
    <div className="space-y-3">
      {eyebrow ? <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-primary/70">{eyebrow}</p> : null}
      <div className="space-y-2">
        <h1 className="font-display text-[2.15rem] font-extrabold tracking-tight text-foreground sm:text-[2.75rem]">{title}</h1>
        <p className="max-w-xl text-sm leading-6 text-muted-foreground sm:text-[1rem]">{description}</p>
      </div>
    </div>
  );
}

export function PrimaryButton(props: React.ComponentProps<typeof Button>) {
  return <Button {...props} variant={props.variant ?? "hero"} className={cn("h-12 w-full rounded-xl text-base font-bold", props.className)} />;
}

export function SecondaryTextLink({ to, children, className }: { to: string; children: React.ReactNode; className?: string }) {
  return <Link to={to as never} className={cn("text-sm font-semibold text-primary transition-colors hover:text-foreground", className)}>{children}</Link>;
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
  return <BaseInput label={label} error={error} render={<Input {...props} className={cn("h-12 rounded-xl border-primary/10 bg-background px-4 text-base shadow-none", className)} />} />;
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
  return <BaseInput label={label} error={error} render={<Textarea {...props} className={cn("min-h-[112px] rounded-xl border-primary/10 bg-background px-4 py-3 text-base shadow-none", className)} />} />;
}

export function SuccessBanner({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-3 rounded-[1.25rem] border border-accent/30 bg-accent/12 px-4 py-3 text-sm text-foreground shadow-[0_12px_28px_-20px_color-mix(in_oklab,var(--color-ung-gold)_26%,transparent)]">
      <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
      <span>{message}</span>
    </div>
  );
}

export function AuthSupportLinks({ primary, secondary }: { primary: React.ReactNode; secondary?: React.ReactNode }) {
  return <div className="flex flex-col items-center gap-3 border-t border-primary/10 pt-3 text-center">{primary}{secondary}</div>;
}
