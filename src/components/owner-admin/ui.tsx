// Shared presentation pieces for the Owner Admin dashboard.
//
// Deliberately desktop-first (wide tables, multi-column KPI grids) — this is
// an internal analyst tool, not the phone-first host app.

import * as React from "react";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import {
  Activity,
  BarChart3,
  Building2,
  CalendarRange,
  ChevronLeft,
  Ellipsis,
  ChevronRight,
  Gauge,
  Search,
  LineChart as LineChartIcon,
  LogOut,
  RefreshCw,
  ShieldCheck,
  UserRound,
  Users,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAttendanceAuth } from "@/components/attendance-hq/auth-provider";
import { useOwnerAdminStatus } from "@/hooks/use-owner-admin-status";
import { ORG_STATUS_LABELS, type OrgStatus } from "@/lib/owner-admin-schemas";

import { cn } from "@/lib/utils";

// ── Formatters ──────────────────────────────────────────────────────────────
export const nf = new Intl.NumberFormat("en-US");

export function fmtNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return nf.format(value);
}

export function fmtPercent(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${value.toFixed(digits)}%`;
}

export function fmtDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function fmtDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function fmtRelative(value: string | null | undefined): string {
  if (!value) return "never";
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return "never";
  const days = Math.floor((Date.now() - then) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

export function fmtDays(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${value} ${value === 1 ? "day" : "days"}`;
}

// ── Access gate ─────────────────────────────────────────────────────────────
/**
 * Client-side convenience gate. The real enforcement lives in the server
 * functions (authoritative email lookup) and in SQL (reports revoked from
 * authenticated), so bypassing this in the browser yields nothing.
 */
export function useOwnerAdminGate() {
  const { loading, user } = useAttendanceAuth();
  const navigate = useNavigate();
  const { isOwner, checking, isError } = useOwnerAdminStatus();

  const denied = (!loading && !user) || isError || (!checking && !!user && !isOwner);

  React.useEffect(() => {
    if (denied) navigate({ to: "/home", replace: true });
  }, [denied, navigate]);

  return {
    ready: !loading && !!user && isOwner,
    checking: loading || checking,
    denied,
  };
}


// ── Shell ───────────────────────────────────────────────────────────────────
const NAV: { to: string; label: string; icon: typeof Gauge; exact?: boolean; group: string }[] = [
  { to: "/owner-admin", label: "Overview", icon: Gauge, exact: true, group: "Platform" },
  { to: "/owner-admin/growth", label: "Activation & retention", icon: LineChartIcon, group: "Platform" },
  { to: "/owner-admin/organizations", label: "Organizations", icon: Building2, group: "Accounts" },
  { to: "/owner-admin/users", label: "Hosts", icon: UserRound, group: "Accounts" },
  { to: "/owner-admin/members", label: "Members", icon: Users, group: "Accounts" },
  { to: "/owner-admin/events", label: "Events", icon: CalendarRange, group: "Activity" },
  { to: "/owner-admin/attendance", label: "Attendance", icon: BarChart3, group: "Activity" },
  { to: "/owner-admin/product", label: "Product & health", icon: Activity, group: "Activity" },
];

const NAV_GROUPS = ["Platform", "Accounts", "Activity"] as const;

function isActive(pathname: string, item: { to: string; exact?: boolean }) {
  return item.exact ? pathname === item.to : pathname.startsWith(item.to);
}

export function OwnerAdminShell({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const { signOut, user } = useAttendanceAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const [loadedAt, setLoadedAt] = React.useState<Date>(() => new Date());

  const current = NAV.filter((item) => isActive(pathname, item)).slice(-1)[0] ?? NAV[0]!;

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await queryClient.invalidateQueries({ queryKey: ["owner-admin"] });
      setLoadedAt(new Date());
    } finally {
      setRefreshing(false);
    }
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await queryClient.cancelQueries();
      queryClient.clear();
      await signOut();
      navigate({ to: "/", replace: true });
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface text-foreground lg:flex">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-border/60 bg-card/70 backdrop-blur lg:flex">
        <div className="flex items-center gap-2.5 px-4 py-4">
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary/12 text-primary">
            <ShieldCheck className="size-4.5" />
          </span>
          <div className="leading-tight">
            <p className="font-display text-[13px] font-extrabold tracking-tight">Attendance HQ</p>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Owner console</p>
          </div>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4">
          {NAV_GROUPS.map((group) => (
            <div key={group}>
              <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80">
                {group}
              </p>
              <div className="space-y-0.5">
                {NAV.filter((item) => item.group === group).map((item) => {
                  const active = isActive(pathname, item);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      className={cn(
                        "flex items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors",
                        active
                          ? "bg-primary/12 text-primary"
                          : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                      )}
                    >
                      <Icon className="size-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-border/60 px-3 py-3">
          {user?.email ? <p className="truncate px-2 pb-2 text-[11px] text-muted-foreground">{user.email}</p> : null}
          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={handleSignOut} disabled={signingOut}>
            <LogOut className="mr-1.5 size-3.5" />
            {signingOut ? "Signing out…" : "Sign out"}
          </Button>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        {/* Mobile: iOS frosted navigation bar */}
        <header className="sticky top-0 z-30 px-3 pt-safe-1 pb-2 lg:hidden">
          <div className="ios-glass flex items-center gap-2 rounded-2xl px-3 py-2">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary">
              <ShieldCheck className="size-3.5" />
            </span>
            <p className="min-w-0 flex-1 truncate font-display text-[15px] font-bold tracking-tight">{current.label}</p>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              aria-label="Refresh live data"
              className="ios-press flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
            >
              <RefreshCw className={cn("size-4", refreshing && "animate-spin")} />
            </button>
          </div>
        </header>

        {/* Desktop command bar */}
        <header className="sticky top-0 z-30 hidden border-b border-border/60 bg-background/85 backdrop-blur lg:block">
          <div className="flex flex-wrap items-center gap-3 px-4 py-3 lg:px-6">
            <div className="leading-tight">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {current.group}
              </p>
              <p className="text-sm font-semibold">{current.label}</p>
            </div>

            <div className="ml-auto flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground">
                Live data as of {loadedAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
              </span>
              <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
                <RefreshCw className={cn("mr-1.5 size-3.5", refreshing && "animate-spin")} />
                {refreshing ? "Refreshing…" : "Refresh"}
              </Button>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1500px] px-4 pb-28 pt-1 lg:px-6 lg:py-8 lg:pb-10">{children}</main>

        {/* Mobile: iOS bottom tab bar */}
        <OwnerTabBar
          pathname={pathname}
          email={user?.email ?? null}
          loadedAt={loadedAt}
          signingOut={signingOut}
          onSignOut={handleSignOut}
        />
      </div>
    </div>
  );
}

const PRIMARY_TABS: { to: string; label: string; icon: typeof Gauge; exact?: boolean }[] = [
  { to: "/owner-admin", label: "Overview", icon: Gauge, exact: true },
  { to: "/owner-admin/organizations", label: "Orgs", icon: Building2 },
  { to: "/owner-admin/members", label: "People", icon: Users },
  { to: "/owner-admin/events", label: "Events", icon: CalendarRange },
];

const MORE_ITEMS = NAV.filter((item) => !PRIMARY_TABS.some((tab) => tab.to === item.to));

function OwnerTabBar({
  pathname,
  email,
  loadedAt,
  signingOut,
  onSignOut,
}: {
  pathname: string;
  email: string | null;
  loadedAt: Date;
  signingOut: boolean;
  onSignOut: () => void;
}) {
  const [moreOpen, setMoreOpen] = React.useState(false);
  const moreActive = MORE_ITEMS.some((item) => isActive(pathname, item));

  return (
    <>
      {moreOpen ? (
        <div className="fixed inset-0 z-[60] lg:hidden" role="dialog" aria-modal="true">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-foreground/25 backdrop-blur-[2px]"
            onClick={() => setMoreOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 rounded-t-[26px] border-t border-border/60 bg-card px-4 pb-safe-1 pt-3 shadow-[0_-20px_50px_-24px_rgba(0,0,0,0.4)]">
            <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-muted-foreground/30" aria-hidden="true" />
            <p className="ios-section-label px-3 mb-2">More reports</p>
            <div className="ios-grouped">
              {MORE_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setMoreOpen(false)}
                    className="ios-list-row"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Icon className="size-[18px]" />
                    </span>
                    <span className="min-w-0 flex-1 text-[15px] font-medium">{item.label}</span>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground/70" />
                  </Link>
                );
              })}
            </div>

            <p className="ios-section-label px-3 mb-2 mt-5">Account</p>
            <div className="ios-grouped mb-4">
              {email ? (
                <div className="ios-list-row">
                  <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{email}</span>
                </div>
              ) : null}
              <div className="ios-list-row">
                <span className="min-w-0 flex-1 text-[15px] font-medium">Live data as of</span>
                <span className="shrink-0 text-[14px] text-muted-foreground">
                  {loadedAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                </span>
              </div>
              <button type="button" className="ios-list-row" onClick={onSignOut} disabled={signingOut}>
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
                  <LogOut className="size-[18px]" />
                </span>
                <span className="min-w-0 flex-1 text-left text-[15px] font-medium text-destructive">
                  {signingOut ? "Signing out…" : "Sign out"}
                </span>
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <nav className="fixed inset-x-0 bottom-0 z-30 px-3 pb-safe-1 pt-2 lg:hidden">
        <div className="ios-glass grid grid-cols-5 gap-1 rounded-[22px] px-1.5 py-1.5">
          {PRIMARY_TABS.map((tab) => {
            const active = isActive(pathname, tab);
            const Icon = tab.icon;
            return (
              <Link
                key={tab.to}
                to={tab.to}
                className={cn(
                  "ios-press flex min-w-0 flex-col items-center gap-1 rounded-2xl px-1 py-1.5 transition-colors",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className="size-[21px] shrink-0" />
                <span className="w-full truncate text-center text-[10px] font-semibold">{tab.label}</span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            className={cn(
              "ios-press flex min-w-0 flex-col items-center gap-1 rounded-2xl px-1 py-1.5 transition-colors",
              moreActive || moreOpen ? "text-primary" : "text-muted-foreground",
            )}
          >
            <Ellipsis className="size-[21px] shrink-0" />
            <span className="w-full truncate text-center text-[10px] font-semibold">More</span>
          </button>
        </div>
      </nav>
    </>
  );
}



export function PageHeading({
  title,
  description,
  eyebrow,
  actions,
}: {
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-5 lg:mb-6 lg:flex lg:flex-wrap lg:items-end lg:justify-between lg:gap-3">
      <div className="min-w-0 px-1 pt-2 lg:px-0 lg:pt-0">
        {eyebrow ? (
          <p className="ios-section-label mb-1.5 text-primary lg:mb-1 lg:text-[10px] lg:tracking-[0.16em]">{eyebrow}</p>
        ) : null}
        <h1 className="ios-large-title lg:font-display lg:text-[26px] lg:font-extrabold lg:tracking-tight">{title}</h1>
        {description ? (
          <p className="mt-2 max-w-2xl text-[15px] leading-snug text-muted-foreground lg:mt-1.5 lg:text-sm">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="mt-4 flex flex-wrap items-center gap-2 lg:mt-0">{actions}</div> : null}
    </div>
  );
}


export function SectionCard({
  title,
  description,
  source,
  actions,
  children,
  className,
}: {
  title?: string;
  description?: string;
  /** Short provenance note: which live records this panel counts. */
  source?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-[22px] border border-border/60 bg-card shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_24px_-20px_rgba(0,0,0,0.25)] lg:rounded-2xl",
        className,
      )}
    >
      {title ? (
        <header className="border-b border-border/60 bg-muted/25 px-4 py-3 sm:flex sm:flex-wrap sm:items-center sm:justify-between sm:gap-2">
          <div className="min-w-0">
            <h2 className="text-[14px] font-semibold tracking-tight sm:text-[13px]">{title}</h2>
            {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
          </div>
          {actions ? <div className="mt-2.5 sm:mt-0">{actions}</div> : null}
        </header>
      ) : null}
      <div className="p-4">{children}</div>
      {source ? (
        <p className="border-t border-border/50 bg-muted/15 px-4 py-2 text-[11px] text-muted-foreground">{source}</p>
      ) : null}
    </section>
  );
}

const TONE_TEXT = {
  default: "text-foreground",
  good: "text-success",
  warn: "text-warning",
  bad: "text-destructive",
} as const;

const TONE_RAIL = {
  default: "bg-primary/40",
  good: "bg-success/60",
  warn: "bg-warning/60",
  bad: "bg-destructive/60",
} as const;

export type KpiTone = keyof typeof TONE_TEXT;

export function KpiCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: KpiTone;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <span className={cn("absolute inset-y-0 left-0 w-[3px]", TONE_RAIL[tone])} aria-hidden="true" />
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className={cn("mt-2 font-display text-[22px] font-extrabold leading-none tabular-nums sm:text-[26px]", TONE_TEXT[tone])}>
        {value}
      </p>
      {hint ? <p className="mt-1.5 text-xs leading-snug text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function KpiGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-4">{children}</div>;
}

// ── Plain-language, at-a-glance pieces (Apple-inspired) ─────────────────────
/**
 * Oversized headline number with a full-sentence caption. Used for the three
 * "how many people are on the app" figures at the top of the overview.
 */
export function HeroStat({
  value,
  label,
  caption,
  emphasis = false,
}: {
  value: React.ReactNode;
  label: string;
  caption?: string;
  emphasis?: boolean;
}) {
  return (
    <div className="min-w-0 py-1">
      <p
        className={cn(
          "font-display text-[clamp(2.5rem,7vw,4rem)] font-semibold leading-[0.95] tracking-[-0.03em] tabular-nums",
          emphasis ? "text-primary" : "text-foreground",
        )}
      >
        {value}
      </p>
      <p className="mt-2 text-[15px] font-medium text-foreground">{label}</p>
      {caption ? <p className="mt-0.5 text-[13px] text-muted-foreground">{caption}</p> : null}
    </div>
  );
}

/** Soft, roomy panel for the simplified screens. */
export function GlanceCard({
  title,
  question,
  children,
  footnote,
  className,
}: {
  title: string;
  question?: string;
  children: React.ReactNode;
  footnote?: string;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-[26px] border border-border/50 bg-card/90 p-5 sm:p-6 shadow-[0_1px_2px_rgba(0,0,0,0.03),0_24px_48px_-32px_rgba(0,0,0,0.28)] backdrop-blur",
        className,
      )}
    >
      <header className="mb-5">
        <h2 className="text-[17px] font-semibold tracking-tight">{title}</h2>
        {question ? <p className="mt-1 text-[13px] text-muted-foreground">{question}</p> : null}
      </header>
      {children}
      {footnote ? <p className="mt-5 border-t border-border/50 pt-3 text-[12px] text-muted-foreground">{footnote}</p> : null}
    </section>
  );
}

/**
 * Single-value ring. Deliberately simple: one filled arc, the percentage in the
 * middle, and a sentence underneath — readable at a glance with no legend.
 */
export function StatRing({
  percent,
  centerLabel,
  size = 168,
  tone = "var(--chart-1)",
}: {
  percent: number;
  centerLabel?: string;
  size?: number;
  tone?: string;
}) {
  const safe = Math.max(0, Math.min(100, Number.isFinite(percent) ? percent : 0));
  const stroke = 14;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = (safe / 100) * circumference;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" role="presentation">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--muted)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={tone}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference - dash}`}
          className="transition-[stroke-dasharray] duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-[30px] font-semibold leading-none tabular-nums">{Math.round(safe)}%</span>
        {centerLabel ? <span className="mt-1 px-4 text-center text-[11px] text-muted-foreground">{centerLabel}</span> : null}
      </div>
    </div>
  );
}

/** Horizontal labelled bars — the simplest way to compare a few buckets. */
export function PlainBars({
  rows,
  unit = "people",
}: {
  rows: { label: string; value: number }[];
  unit?: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="space-y-3.5">
      {rows.map((row) => (
        <div key={row.label}>
          <div className="mb-1.5 flex items-baseline justify-between gap-3">
            <span className="text-[13px] text-foreground">{row.label}</span>
            <span className="text-[13px] font-medium tabular-nums text-muted-foreground">
              {fmtNumber(row.value)} {unit}
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary/80 transition-[width] duration-700 ease-out"
              style={{ width: `${Math.max(row.value > 0 ? 4 : 0, (row.value / max) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}


/** Explicit "nothing recorded yet" state so a real zero never reads as a broken widget. */
export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 px-4 py-10 text-center">
      <p className="text-sm font-medium text-foreground">{title}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

const STATUS_TONES: Record<string, string> = {
  power_user: "bg-success/12 text-success",
  healthy: "bg-info/12 text-info",
  at_risk: "bg-warning/14 text-warning",
  churning: "bg-warning/18 text-warning",
  dormant: "bg-destructive/12 text-destructive",
  never_activated: "bg-muted text-muted-foreground",
};

export function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
        STATUS_TONES[status] ?? "bg-muted text-muted-foreground",
      )}
    >
      {ORG_STATUS_LABELS[status as OrgStatus] ?? status}
    </span>
  );
}

export function HealthBar({ score }: { score: number }) {
  const tone = score >= 70 ? "bg-success" : score >= 45 ? "bg-warning" : "bg-destructive";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full", tone)} style={{ width: `${Math.max(2, Math.min(100, score))}%` }} />
      </div>
      <span className="text-xs font-medium tabular-nums">{score}</span>
    </div>

  );
}

export function SearchField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
}) {
  return (
    <label className="flex w-full items-center gap-2 rounded-2xl bg-muted px-3 sm:w-72 sm:rounded-md sm:bg-transparent sm:px-0">
      <Search className="size-4 shrink-0 text-muted-foreground sm:hidden" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-10 w-full min-w-0 border-0 bg-transparent px-0 text-[15px] shadow-none focus-visible:ring-0 sm:h-9 sm:border sm:bg-background sm:px-3 sm:text-sm sm:shadow-xs sm:focus-visible:ring-[3px]"
      />
    </label>
  );
}

export function Pager({
  total,
  limit,
  offset,
  onOffset,
}: {
  total: number;
  limit: number;
  offset: number;
  onOffset: (next: number) => void;
}) {
  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(total, offset + limit);
  return (
    <div className="mt-3 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
      <p className="text-center text-xs text-muted-foreground sm:text-left">
        {fmtNumber(from)}–{fmtNumber(to)} of {fmtNumber(total)}
      </p>
      <div className="grid grid-cols-2 gap-2 sm:flex sm:gap-1">
        <Button
          variant="outline"
          className="ios-press h-11 rounded-2xl text-[15px] sm:h-8 sm:rounded-md sm:px-3 sm:text-sm"
          disabled={offset <= 0}
          onClick={() => onOffset(Math.max(0, offset - limit))}
        >
          <ChevronLeft className="size-4" />
          <span className="sm:hidden">Previous</span>
        </Button>
        <Button
          variant="outline"
          className="ios-press h-11 rounded-2xl text-[15px] sm:h-8 sm:rounded-md sm:px-3 sm:text-sm"
          disabled={to >= total}
          onClick={() => onOffset(offset + limit)}
        >
          <span className="sm:hidden">Next</span>
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}

export function DataTable<T>({
  rows,
  columns,
  empty = "No rows recorded yet.",
  rowKey,
  minWidth = 760,
  mobile,
}: {
  rows: T[];
  columns: { key: string; header: string; align?: "left" | "right"; render: (row: T) => React.ReactNode }[];
  empty?: string;
  rowKey: (row: T, index: number) => string;
  minWidth?: number;
  /**
   * Optional phone presentation. On mobile the table becomes a grouped list of
   * cards, because a 760px-wide table can only be read by scrolling sideways.
   * When omitted, the first column becomes the title and the rest become
   * label/value pairs, so no page can break.
   */
  mobile?: {
    /** Column keys shown as the row title / subtitle. */
    title?: (row: T) => React.ReactNode;
    subtitle?: (row: T) => React.ReactNode;
    /** Column keys rendered as the compact stat grid under the title. */
    stats?: string[];
  };
}) {
  if (!rows.length) {
    return <EmptyState title={empty} hint="This table reads live application records — nothing matches yet." />;
  }

  const [firstColumn, ...restColumns] = columns;
  const statColumns = mobile?.stats
    ? columns.filter((col) => mobile.stats!.includes(col.key))
    : restColumns.slice(0, 4);

  return (
    <>
      {/* Phone: grouped cards */}
      <div className="space-y-2.5 sm:hidden">
        {rows.map((row, index) => (
          <article key={rowKey(row, index)} className="rounded-2xl border border-border/50 bg-card/80 p-3.5">
            <div className="min-w-0 text-[15px] font-semibold leading-snug">
              {mobile?.title ? mobile.title(row) : firstColumn ? firstColumn.render(row) : null}
            </div>
            {mobile?.subtitle ? (
              <div className="mt-0.5 min-w-0 text-[13px] text-muted-foreground">{mobile.subtitle(row)}</div>
            ) : null}
            {statColumns.length ? (
              <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2.5 border-t border-border/40 pt-3">
                {statColumns.map((col) => (
                  <div key={col.key} className="min-w-0">
                    <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      {col.header}
                    </dt>
                    <dd className="mt-0.5 truncate text-[14px] tabular-nums">{col.render(row)}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </article>
        ))}
      </div>

      {/* Tablet and up: real table */}
      <div className="-mx-4 hidden max-h-[70vh] overflow-auto px-4 sm:block">
        <table className="w-full border-collapse text-sm" style={{ minWidth }}>
          <thead className="sticky top-0 z-10">
            <tr className="text-left">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    "border-b border-border/60 bg-card px-2 py-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground",
                    col.align === "right" && "text-right",
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr
                key={rowKey(row, index)}
                className="border-b border-border/40 transition-colors last:border-0 hover:bg-primary/[0.04]"
              >
                {columns.map((col) => (
                  <td key={col.key} className={cn("px-2 py-2.5 align-middle", col.align === "right" && "text-right tabular-nums")}>
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/** iOS-style segmented control for the range switchers. */
export function RangeSegmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (next: T) => void;
  options: { key: T; label: string }[];
}) {
  return (
    <div className="inline-flex w-full rounded-2xl bg-muted p-1 sm:w-auto sm:rounded-xl">
      {options.map((opt) => (
        <button
          key={opt.key}
          type="button"
          onClick={() => onChange(opt.key)}
          className={cn(
            "ios-press flex-1 whitespace-nowrap rounded-[0.9rem] px-3 py-2 text-[13px] font-semibold transition-colors sm:py-1.5 sm:text-[12px]",
            opt.key === value
              ? "bg-card text-foreground shadow-[0_2px_6px_rgba(15,23,42,0.08)]"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}


export function LoadingBlock({ label = "Loading live data…" }: { label?: string }) {
  return <div className="py-16 text-center text-sm text-muted-foreground">{label}</div>;
}

export function ErrorBlock({ message }: { message?: string }) {
  return (
    <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
      {message ?? "Unable to load this report."}
    </div>
  );
}

// ── Charts ──────────────────────────────────────────────────────────────────
/**
 * Series palette. These are the project's design-system chart tokens, so charts
 * follow light/dark theming instead of hardcoded hex.
 */
export const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
] as const;

const CHART_MARGIN = { top: 6, right: 8, bottom: 0, left: -18 };


function tooltipStyle() {
  return {
    contentStyle: {
      background: "var(--card)",
      border: "1px solid var(--border)",
      borderRadius: 10,
      fontSize: 12,
    },
    labelStyle: { color: "var(--muted-foreground)" },
  } as const;
}

export function TrendArea({
  data,
  xKey,
  series,
  height = 220,
}: {
  data: Record<string, unknown>[];
  xKey: string;
  series: { key: string; label: string; color: string }[];
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={CHART_MARGIN}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey={xKey} tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
        <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" allowDecimals={false} />
        <Tooltip {...tooltipStyle()} />
        {series.map((s) => (
          <Area
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stroke={s.color}
            fill={s.color}
            fillOpacity={0.16}
            strokeWidth={2}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function TrendLine({
  data,
  xKey,
  series,
  height = 220,
}: {
  data: Record<string, unknown>[];
  xKey: string;
  series: { key: string; label: string; color: string }[];
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={CHART_MARGIN}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey={xKey} tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
        <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" allowDecimals={false} />
        <Tooltip {...tooltipStyle()} />
        {series.map((s) => (
          <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={2} dot={false} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function SimpleBars({
  data,
  xKey,
  valueKey,
  label,
  height = 220,
  color = "var(--chart-1)",
}: {
  data: Record<string, unknown>[];
  xKey: string;
  valueKey: string;
  label: string;
  height?: number;
  color?: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={CHART_MARGIN}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey={xKey} tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
        <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" allowDecimals={false} />
        <Tooltip {...tooltipStyle()} />
        <Bar dataKey={valueKey} name={label} fill={color} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export const OWNER_NOINDEX_META = [
  { name: "robots", content: "noindex, nofollow" },
] as const;
