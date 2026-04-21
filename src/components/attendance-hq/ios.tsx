import * as React from "react";
import { Link } from "@tanstack/react-router";
import { ChevronRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/* ─── Brand mark (auth-free) ──────────────────────────────────────────── */
export function BrandMark({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const dim = size === "sm" ? "h-9 w-9" : size === "lg" ? "h-14 w-14" : "h-11 w-11";
  const txt = size === "sm" ? "text-base" : size === "lg" ? "text-2xl" : "text-lg";
  return (
    <div className="inline-flex items-center gap-2.5">
      <div className={cn("flex items-center justify-center rounded-2xl bg-gradient-brand text-primary-foreground font-display font-extrabold ios-cta-shadow", dim, txt)}>A</div>
      <span className="font-display text-[17px] font-extrabold tracking-tight text-foreground">Attendance HQ</span>
    </div>
  );
}

/* ─── iOS large-title header for top of screen ────────────────────────── */
export function LargeTitleHeader({
  eyebrow,
  title,
  subtitle,
  trailing,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  trailing?: React.ReactNode;
}) {
  return (
    <header className="px-1 pb-3 pt-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {eyebrow ? <p className="ios-section-label mb-2">{eyebrow}</p> : null}
          <h1 className="ios-large-title">{title}</h1>
          {subtitle ? <p className="mt-2 text-[15px] leading-snug text-muted-foreground">{subtitle}</p> : null}
        </div>
        {trailing ? <div className="shrink-0 pt-1">{trailing}</div> : null}
      </div>
    </header>
  );
}

/* ─── Frosted top bar (inline screens) ────────────────────────────────── */
export function FrostedTopBar({
  leading,
  title,
  trailing,
}: {
  leading?: React.ReactNode;
  title?: React.ReactNode;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="sticky top-0 z-30 -mx-4 px-4 pt-safe-1 pb-2 sm:-mx-5 sm:px-5">
      <div className="ios-glass rounded-2xl px-3 py-2.5 flex items-center gap-2">
        <div className="flex items-center gap-1">{leading}</div>
        <div className="min-w-0 flex-1 text-center">
          {typeof title === "string" ? (
            <p className="truncate font-display text-[15px] font-bold text-foreground">{title}</p>
          ) : title}
        </div>
        <div className="flex items-center gap-1">{trailing}</div>
      </div>
    </div>
  );
}

/* ─── Section label ──────────────────────────────────────────────────── */
export function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("ios-section-label px-3 mb-2", className)}>{children}</p>;
}

/* ─── Grouped list (Apple Settings style) ────────────────────────────── */
export function GroupedList({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("ios-grouped", className)}>{children}</div>;
}

export interface ListRowProps {
  icon?: LucideIcon;
  iconBg?: string;
  iconColor?: string;
  label: React.ReactNode;
  detail?: React.ReactNode;
  value?: React.ReactNode;
  to?: string;
  params?: Record<string, string>;
  search?: Record<string, unknown>;
  onClick?: () => void;
  trailing?: React.ReactNode;
  destructive?: boolean;
  chevron?: boolean;
  asExternal?: boolean;
  href?: string;
}

export function ListRow({
  icon: Icon,
  iconBg = "bg-primary/10",
  iconColor = "text-primary",
  label,
  detail,
  value,
  to,
  params,
  search,
  onClick,
  trailing,
  destructive,
  chevron = true,
  asExternal,
  href,
}: ListRowProps) {
  const inner = (
    <>
      {Icon ? (
        <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", iconBg)}>
          <Icon className={cn("h-[18px] w-[18px]", iconColor)} />
        </span>
      ) : null}
      <div className="min-w-0 flex-1">
        <div className={cn("text-[15px] font-medium leading-tight", destructive ? "text-destructive" : "text-foreground")}>
          {label}
        </div>
        {detail ? <div className="mt-0.5 text-[13px] text-muted-foreground">{detail}</div> : null}
      </div>
      {value ? <div className="text-[14px] text-muted-foreground">{value}</div> : null}
      {trailing}
      {chevron && (to || onClick || href) ? <ChevronRight className="h-4 w-4 text-muted-foreground/70" /> : null}
    </>
  );

  if (to) {
    return (
      <Link to={to as never} params={params as never} search={search as never} className="ios-list-row">
        {inner}
      </Link>
    );
  }
  if (asExternal && href) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className="ios-list-row">
        {inner}
      </a>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="ios-list-row">
        {inner}
      </button>
    );
  }
  return <div className="ios-list-row">{inner}</div>;
}

/* ─── Segmented control ──────────────────────────────────────────────── */
export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (next: T) => void;
  options: { value: T; label: string }[];
  className?: string;
}) {
  return (
    <div className={cn("inline-flex w-full rounded-2xl bg-muted p-1", className)}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "ios-press flex-1 rounded-[1.05rem] px-3 py-2 text-[13px] font-semibold transition-colors",
              active ? "bg-card text-foreground shadow-[0_2px_6px_rgba(15,23,42,0.08)]" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/* ─── Stat tile (Apple Fitness style) ────────────────────────────────── */
export function StatTile({
  label,
  value,
  hint,
  tone = "default",
  icon: Icon,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "gold" | "blue" | "success";
  icon?: LucideIcon;
}) {
  const toneClass =
    tone === "gold"
      ? "bg-gradient-gold text-accent-foreground"
      : tone === "blue"
        ? "bg-gradient-brand text-primary-foreground"
        : tone === "success"
          ? "bg-success/12 text-success-foreground border border-success/20"
          : "ios-card";
  return (
    <div className={cn("rounded-2xl p-4 min-w-[10rem]", toneClass)}>
      <div className="flex items-center justify-between gap-2">
        <p className={cn("text-[11px] font-semibold uppercase tracking-wider", tone === "default" ? "text-muted-foreground" : "opacity-80")}>{label}</p>
        {Icon ? <Icon className={cn("h-4 w-4", tone === "default" ? "text-primary" : "opacity-90")} /> : null}
      </div>
      <p className={cn("mt-2 font-display text-[28px] font-extrabold leading-none tracking-tight", tone === "default" ? "text-foreground" : "")}>{value}</p>
      {hint ? <p className={cn("mt-1.5 text-[12px]", tone === "default" ? "text-muted-foreground" : "opacity-80")}>{hint}</p> : null}
    </div>
  );
}

/* ─── Action tile (Home command center) ──────────────────────────────── */
export function ActionTile({
  icon: Icon,
  label,
  hint,
  tone = "default",
  to,
  params,
  search,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  hint?: string;
  tone?: "default" | "gold" | "blue";
  to?: string;
  params?: Record<string, string>;
  search?: Record<string, unknown>;
  onClick?: () => void;
}) {
  const toneClass =
    tone === "gold"
      ? "bg-gradient-gold text-accent-foreground"
      : tone === "blue"
        ? "bg-gradient-brand text-primary-foreground"
        : "ios-card";
  const iconWrap =
    tone === "default" ? "bg-primary/10 text-primary" : "bg-white/20 text-current";
  const className = cn(
    "ios-press flex h-full flex-col items-start justify-between gap-3 rounded-2xl p-4 text-left",
    toneClass,
  );
  const inner = (
    <>
      <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", iconWrap)}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <div className="font-display text-[15px] font-bold leading-tight">{label}</div>
        {hint ? <div className={cn("mt-1 text-[12px]", tone === "default" ? "text-muted-foreground" : "opacity-85")}>{hint}</div> : null}
      </div>
    </>
  );
  if (to) {
    return (
      <Link to={to as never} params={params as never} search={search as never} className={className}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={className}>
      {inner}
    </button>
  );
}

/* ─── Success burst ─────────────────────────────────────────────────── */
export function SuccessBurst({ children }: { children?: React.ReactNode }) {
  return (
    <div className="relative mx-auto flex h-24 w-24 items-center justify-center">
      <div className="absolute inset-0 rounded-full bg-success/15 ios-success-burst" />
      <div className="absolute inset-3 rounded-full bg-success/25 ios-success-burst" style={{ animationDelay: "60ms" }} />
      <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-success text-white shadow-[0_18px_40px_-10px_color-mix(in_oklab,var(--color-success)_50%,transparent)] ios-success-burst" style={{ animationDelay: "120ms" }}>
        {children ?? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8">
            <path d="M5 12l5 5L20 7" />
          </svg>
        )}
      </div>
    </div>
  );
}

/* ─── iOS pill chip ─────────────────────────────────────────────────── */
export function Chip({
  children,
  tone = "default",
  className,
}: {
  children: React.ReactNode;
  tone?: "default" | "blue" | "gold" | "success" | "muted" | "destructive";
  className?: string;
}) {
  const toneClass =
    tone === "blue"
      ? "bg-primary/10 text-primary border-primary/15"
      : tone === "gold"
        ? "bg-accent/15 text-accent-foreground border-accent/30"
        : tone === "success"
          ? "bg-success/12 text-success border-success/20"
          : tone === "destructive"
            ? "bg-destructive/10 text-destructive border-destructive/20"
            : tone === "muted"
              ? "bg-muted text-muted-foreground border-border"
              : "bg-secondary text-secondary-foreground border-border";
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-semibold", toneClass, className)}>
      {children}
    </span>
  );
}

/* ─── iOS rounded search field ──────────────────────────────────────── */
export function IosSearchField({
  value,
  onChange,
  placeholder = "Search",
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  return (
    <label className="flex items-center gap-2 rounded-2xl bg-muted px-3.5 py-2.5">
      <svg className="h-4 w-4 text-muted-foreground" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2}>
        <circle cx="9" cy="9" r="6" />
        <path d="m14 14 4 4" strokeLinecap="round" />
      </svg>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="flex-1 bg-transparent text-[15px] text-foreground placeholder:text-muted-foreground focus:outline-none"
      />
    </label>
  );
}

/* ─── Sticky bottom CTA bar (safe-area aware) ───────────────────────── */
export function StickyCtaBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="sticky bottom-0 z-20 -mx-4 mt-6 px-4 pb-safe-1 pt-3 sm:-mx-5 sm:px-5">
      <div className="ios-glass rounded-3xl p-2.5">{children}</div>
    </div>
  );
}
