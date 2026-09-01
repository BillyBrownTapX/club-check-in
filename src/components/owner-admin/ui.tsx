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
  ChevronRight,
  Gauge,
  LineChart as LineChartIcon,
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

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAttendanceAuth, useAuthorizedQuery } from "@/components/attendance-hq/auth-provider";
import { ORG_STATUS_LABELS, type OrgStatus } from "@/lib/owner-admin-schemas";
import { getOwnerAdminMe } from "@/lib/owner-admin.functions";
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
const NAV: { to: string; label: string; icon: typeof Gauge; exact?: boolean }[] = [
  { to: "/owner-admin", label: "Overview", icon: Gauge, exact: true },
  { to: "/owner-admin/organizations", label: "Organizations", icon: Building2 },
  { to: "/owner-admin/users", label: "Users", icon: UserRound },
  { to: "/owner-admin/members", label: "Members", icon: Users },
  { to: "/owner-admin/events", label: "Events", icon: CalendarRange },
  { to: "/owner-admin/attendance", label: "Attendance", icon: BarChart3 },
  { to: "/owner-admin/growth", label: "Activation & retention", icon: LineChartIcon },
  { to: "/owner-admin/product", label: "Product & health", icon: Activity },
];


export function OwnerAdminShell({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1400px] flex-wrap items-center gap-3 px-4 py-3 lg:px-8">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary/12 text-primary">
              <ShieldCheck className="size-4" />
            </span>
            <div className="leading-tight">
              <p className="text-sm font-semibold">Attendance HQ · Owner</p>
              <p className="text-[11px] text-muted-foreground">Internal platform analytics</p>
            </div>
          </div>
          <div className="ml-auto">
            <Button asChild variant="ghost" size="sm">
              <Link to="/home">Exit to app</Link>
            </Button>
          </div>
        </div>
        <nav className="mx-auto flex w-full max-w-[1400px] gap-1 overflow-x-auto px-4 pb-2 lg:px-8">
          {NAV.map((item) => {
            const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                  active
                    ? "bg-primary/12 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="size-3.5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-[1400px] px-4 py-6 lg:px-8">{children}</main>
    </div>
  );
}

export function PageHeading({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function SectionCard({
  title,
  description,
  actions,
  children,
  className,
}: {
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-xl border border-border/60 bg-card shadow-sm", className)}>
      {title ? (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold">{title}</h2>
            {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
          </div>
          {actions}
        </header>
      ) : null}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function KpiCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: "default" | "good" | "warn" | "bad";
}) {
  const toneClass =
    tone === "good"
      ? "text-emerald-500"
      : tone === "warn"
        ? "text-amber-500"
        : tone === "bad"
          ? "text-destructive"
          : "text-foreground";
  return (
    <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("mt-1.5 text-2xl font-semibold tabular-nums", toneClass)}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function KpiGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{children}</div>;
}

const STATUS_TONES: Record<string, string> = {
  power_user: "bg-emerald-500/12 text-emerald-500",
  healthy: "bg-sky-500/12 text-sky-500",
  at_risk: "bg-amber-500/12 text-amber-500",
  churning: "bg-orange-500/14 text-orange-500",
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
  const tone = score >= 70 ? "bg-emerald-500" : score >= 45 ? "bg-amber-500" : "bg-destructive";
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
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="h-9 w-full sm:w-72"
    />
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
    <div className="mt-3 flex items-center justify-between gap-3">
      <p className="text-xs text-muted-foreground">
        {fmtNumber(from)}–{fmtNumber(to)} of {fmtNumber(total)}
      </p>
      <div className="flex gap-1">
        <Button
          variant="outline"
          size="sm"
          disabled={offset <= 0}
          onClick={() => onOffset(Math.max(0, offset - limit))}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <Button variant="outline" size="sm" disabled={to >= total} onClick={() => onOffset(offset + limit)}>
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}

export function DataTable<T>({
  rows,
  columns,
  empty = "No rows.",
  rowKey,
}: {
  rows: T[];
  columns: { key: string; header: string; align?: "left" | "right"; render: (row: T) => React.ReactNode }[];
  empty?: string;
  rowKey: (row: T, index: number) => string;
}) {
  if (!rows.length) {
    return <p className="py-8 text-center text-sm text-muted-foreground">{empty}</p>;
  }
  return (
    <div className="-mx-4 overflow-x-auto px-4">
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border/60 text-left">
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  "px-2 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground",
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
            <tr key={rowKey(row, index)} className="border-b border-border/40 last:border-0 hover:bg-muted/40">
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
  );
}

export function LoadingBlock({ label = "Loading…" }: { label?: string }) {
  return <div className="py-16 text-center text-sm text-muted-foreground">{label}</div>;
}

export function ErrorBlock({ message }: { message?: string }) {
  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
      {message ?? "Unable to load this report."}
    </div>
  );
}

// ── Charts ──────────────────────────────────────────────────────────────────
const CHART_MARGIN = { top: 6, right: 8, bottom: 0, left: -18 };

function tooltipStyle() {
  return {
    contentStyle: {
      background: "hsl(var(--card))",
      border: "1px solid hsl(var(--border))",
      borderRadius: 10,
      fontSize: 12,
    },
    labelStyle: { color: "hsl(var(--muted-foreground))" },
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
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey={xKey} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
        <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
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
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey={xKey} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
        <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
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
  color = "hsl(var(--primary))",
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
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey={xKey} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
        <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
        <Tooltip {...tooltipStyle()} />
        <Bar dataKey={valueKey} name={label} fill={color} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export const OWNER_NOINDEX_META = [
  { name: "robots", content: "noindex, nofollow" },
] as const;
