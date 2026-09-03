import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ReferenceLine, XAxis, YAxis } from "recharts";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import type { HostMetricBreakdown } from "@/lib/attendance-hq";

export type MetricKey = "retention" | "success" | "growth";

const TITLES: Record<MetricKey, { title: string; blurb: string }> = {
  retention: {
    title: "Member retention",
    blurb: "How many of your members come back for a second meeting.",
  },
  success: {
    title: "Event success",
    blurb: "Typical turnout per meeting measured against your whole roster.",
  },
  growth: {
    title: "Growth (30 days)",
    blurb: "First-time members this month versus the month before.",
  },
};

function shortDate(iso: string) {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString([], { month: "short", day: "numeric", timeZone: "UTC" });
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-muted/50 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">How this is calculated</p>
      <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{children}</p>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="ios-card rounded-2xl p-5 text-center text-[13px] text-muted-foreground">{children}</p>;
}

const config: ChartConfig = {
  members: { label: "Members", color: "var(--primary)" },
  attendees: { label: "Check-ins", color: "var(--primary)" },
  count: { label: "New members", color: "var(--primary)" },
};

function RetentionBody({ data }: { data: HostMetricBreakdown }) {
  const oneTime = Math.max(data.retentionEligible - data.retentionReturned, 0);
  if (!data.retentionEligible) {
    return (
      <Empty>
        Retention needs at least two past events with members who had a chance to return. Hold another meeting and this
        fills in automatically.
      </Empty>
    );
  }
  const split = [
    { label: "Returned", members: data.retentionReturned },
    { label: "One-time", members: oneTime },
  ];
  return (
    <div className="space-y-4">
      <Formula>
        {data.retentionReturned} returned ÷ {data.retentionEligible} eligible = {data.retentionPct ?? 0}%
      </Formula>
      <ChartContainer config={config} className="h-[140px] w-full">
        <BarChart data={split} layout="vertical" margin={{ left: 4, right: 12 }}>
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="label" width={72} tickLine={false} axisLine={false} fontSize={12} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Bar dataKey="members" radius={6}>
            {split.map((s) => (
              <Cell key={s.label} className={s.label === "Returned" ? "fill-primary" : "fill-muted-foreground/30"} />
            ))}
          </Bar>
        </BarChart>
      </ChartContainer>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Events attended per member</p>
        <ChartContainer config={config} className="mt-2 h-[160px] w-full">
          <BarChart data={data.eventsPerMemberBuckets} margin={{ left: -16, right: 8 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="bucket" tickLine={false} axisLine={false} fontSize={12} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="members" className="fill-primary" radius={6} />
          </BarChart>
        </ChartContainer>
      </div>
      <Note>
        A member counts as eligible once their first check-in or pre-check-in happened before your most recent past
        event, so they actually had a later meeting to attend. They count as returned when they appear at two or more
        distinct events. Upcoming events are excluded.
      </Note>
    </div>
  );
}

function SuccessBody({ data }: { data: HostMetricBreakdown }) {
  if (!data.eventAttendance.length) {
    return <Empty>This score appears after your first event has passed and check-ins are recorded.</Empty>;
  }
  const series = data.eventAttendance.map((e) => ({ ...e, label: shortDate(e.date) }));
  return (
    <div className="space-y-4">
      <Formula>
        avg {data.avgAttendancePerEvent} per event ÷ {data.totalMembers} members = {data.eventSuccessPct ?? 0}%
      </Formula>
      <ChartContainer config={config} className="h-[190px] w-full">
        <BarChart data={series} margin={{ left: -16, right: 8 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} interval="preserveStartEnd" />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} />
          <ChartTooltip
            content={
              <ChartTooltipContent
                labelFormatter={(_label, payload) => {
                  const row = payload?.[0]?.payload as { name?: string; date?: string } | undefined;
                  return row ? `${row.name} · ${shortDate(row.date ?? "")}` : "";
                }}
              />
            }
          />
          <ReferenceLine y={data.avgAttendancePerEvent} className="stroke-accent" strokeDasharray="4 4" />
          <Bar dataKey="attendees" className="fill-primary" radius={6} />
        </BarChart>
      </ChartContainer>
      <p className="text-[12px] text-muted-foreground">
        Dashed line = average of {data.avgAttendancePerEvent} across {data.pastEventCount} past
        {data.pastEventCount === 1 ? " event" : " events"}.
      </p>
      <Note>
        Each bar counts every check-in and pre-check-in recorded for that past event. The score divides the average bar
        height by your total member roster ({data.totalMembers}), so 100% would mean every member you have ever reached
        shows up to a typical meeting.
      </Note>
    </div>
  );
}

function GrowthBody({ data }: { data: HostMetricBreakdown }) {
  const compare = [
    { label: "Prior 30d", count: data.newMembersPrior30d },
    { label: "Last 30d", count: data.newMembers30d },
  ];
  const weekly = data.newMembersByWeek.map((w) => ({ ...w, label: shortDate(w.weekStart) }));
  return (
    <div className="space-y-4">
      <Formula>
        {data.newMembersPrior30d > 0
          ? `(${data.newMembers30d} − ${data.newMembersPrior30d}) ÷ ${data.newMembersPrior30d} = ${data.growthRatePct ?? 0}%`
          : data.newMembers30d > 0
            ? `${data.newMembers30d} new with no prior-month baseline = +100%`
            : "No new members in either window yet"}
      </Formula>
      <ChartContainer config={config} className="h-[150px] w-full">
        <BarChart data={compare} margin={{ left: -16, right: 8 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Bar dataKey="count" radius={6}>
            {compare.map((c) => (
              <Cell key={c.label} className={c.label === "Last 30d" ? "fill-primary" : "fill-muted-foreground/30"} />
            ))}
          </Bar>
        </BarChart>
      </ChartContainer>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">First-time members by week</p>
        <ChartContainer config={config} className="mt-2 h-[160px] w-full">
          <LineChart data={weekly} margin={{ left: -16, right: 8 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} interval="preserveStartEnd" />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Line type="monotone" dataKey="count" className="stroke-primary" strokeWidth={2} dot={{ r: 3, className: "fill-primary stroke-primary" }} />
          </LineChart>
        </ChartContainer>
      </div>
      <Note>
        A member is "new" in the week of their very first check-in or pre-check-in anywhere in your clubs — repeat
        attendance never counts twice. The percentage compares the last 30 days against the 30 days before it.
      </Note>
    </div>
  );
}

export function MetricDetailSheet({
  metric,
  onOpenChange,
  data,
  loading,
  error,
}: {
  metric: MetricKey | null;
  onOpenChange: (open: boolean) => void;
  data?: HostMetricBreakdown;
  loading: boolean;
  error?: string | null;
}) {
  const meta = metric ? TITLES[metric] : null;
  return (
    <Dialog open={metric !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-lg overflow-y-auto rounded-3xl">
        <DialogHeader className="text-left">
          <DialogTitle className="font-display text-[20px] font-extrabold">{meta?.title ?? ""}</DialogTitle>
          <DialogDescription className="text-[13px]">{meta?.blurb ?? ""}</DialogDescription>
        </DialogHeader>
        {error ? (
          <p className="text-[13px] text-destructive">{error}</p>
        ) : loading || !data ? (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full rounded-2xl" />
            <Skeleton className="h-40 w-full rounded-2xl" />
            <Skeleton className="h-24 w-full rounded-2xl" />
          </div>
        ) : metric === "retention" ? (
          <RetentionBody data={data} />
        ) : metric === "success" ? (
          <SuccessBody data={data} />
        ) : metric === "growth" ? (
          <GrowthBody data={data} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
