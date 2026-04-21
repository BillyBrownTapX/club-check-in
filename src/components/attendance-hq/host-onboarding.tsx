import * as React from "react";
import { Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { BrandMark } from "@/components/attendance-hq/ios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

function ShellBackdrop({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="blur-orb-blue -left-12 -top-10 h-40 w-40 opacity-40" />
      <div className="blur-orb-gold -bottom-12 -right-10 h-44 w-44 opacity-40" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-[480px] flex-col px-4 pb-safe pt-safe-1 sm:max-w-[520px] sm:px-5">
        {children}
      </div>
    </div>
  );
}

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <ShellBackdrop>
      <header className="flex items-center justify-between py-3">
        <BrandMark size="sm" />
        <Button asChild variant="ghost" size="sm" className="rounded-full text-muted-foreground">
          <Link to="/">Home</Link>
        </Button>
      </header>
      <main className="flex flex-1 flex-col justify-center py-4">{children}</main>
    </ShellBackdrop>
  );
}

export function AuthCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="ios-card rounded-[1.75rem] p-6 ios-spring-in">
      <div className="space-y-5">{children}</div>
    </div>
  );
}

export function OnboardingShell({ children }: { children: React.ReactNode }) {
  return (
    <ShellBackdrop>
      <header className="flex items-center justify-between py-3">
        <BrandMark size="sm" />
      </header>
      <main className="flex flex-1 flex-col justify-start py-3">{children}</main>
    </ShellBackdrop>
  );
}

export function FormCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("ios-card rounded-[1.75rem] p-5 sm:p-6 space-y-5 ios-spring-in", className)}>{children}</div>;
}

export function ProgressIndicator({ step, total, label }: { step: number; total: number; label: string }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-semibold text-foreground">Step {step} of {total}</span>
        <span className="text-[13px] text-muted-foreground">{label}</span>
      </div>
      <div className="flex gap-1.5">
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-colors",
              i < step ? "bg-primary" : "bg-muted",
            )}
          />
        ))}
      </div>
    </div>
  );
}

export function PageHeadingBlock({ eyebrow, title, description }: { eyebrow?: string; title: string; description: string }) {
  return (
    <div className="space-y-2">
      {eyebrow ? <p className="ios-section-label">{eyebrow}</p> : null}
      <h1 className="ios-screen-title">{title}</h1>
      <p className="text-[14.5px] leading-6 text-muted-foreground">{description}</p>
    </div>
  );
}

export function PrimaryButton(props: React.ComponentProps<typeof Button>) {
  return (
    <Button
      {...props}
      variant={props.variant ?? "hero"}
      size={props.size ?? "xl"}
      className={cn("w-full", props.className)}
    />
  );
}

export function SecondaryTextLink({ to, children, className }: { to: string; children: React.ReactNode; className?: string }) {
  return (
    <Link to={to as never} className={cn("text-[13.5px] font-semibold text-primary transition-colors hover:text-foreground", className)}>
      {children}
    </Link>
  );
}

export function InlineErrorMessage({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-[13.5px] font-medium text-destructive">{message}</p>;
}

function BaseInput({ label, error, render }: { label: string; error?: string; render: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="text-[13px] font-semibold text-foreground">{label}</Label>
      {render}
      <InlineErrorMessage message={error} />
    </div>
  );
}

export function TextInput({ label, error, className, ...props }: React.ComponentProps<typeof Input> & { label: string; error?: string }) {
  return (
    <BaseInput
      label={label}
      error={error}
      render={<Input {...props} className={cn("h-12 rounded-xl border-border/80 bg-muted/40 px-4 text-[15px] shadow-none focus-visible:bg-card", className)} />}
    />
  );
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
  return (
    <BaseInput
      label={label}
      error={error}
      render={<Textarea {...props} className={cn("min-h-[100px] rounded-xl border-border/80 bg-muted/40 px-4 py-3 text-[15px] shadow-none focus-visible:bg-card", className)} />}
    />
  );
}

export function SuccessBanner({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2.5 rounded-2xl border border-success/25 bg-success/10 px-3.5 py-3 text-[13.5px] text-foreground">
      <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-success" />
      <span>{message}</span>
    </div>
  );
}

export function AuthSupportLinks({ primary, secondary }: { primary: React.ReactNode; secondary?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2.5 border-t border-border/60 pt-4 text-center">
      {primary}
      {secondary}
    </div>
  );
}
