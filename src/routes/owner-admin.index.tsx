// Owner Admin — the at-a-glance answer to "how many people are on the app,
// are they checking in, and do they come back?"
//
// Deliberately plain: three big numbers, then three cards that each ask one
// question in a full sentence and answer it with one simple visual.

import * as React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";

import { useAuthorizedQuery } from "@/components/attendance-hq/auth-provider";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  CHART_COLORS,
  EmptyState,
  ErrorBlock,
  GlanceCard,
  HeroStat,
  LoadingBlock,
  PlainBars,
  RangeSegmented,
  StatRing,
  TrendArea,
  fmtNumber,
} from "@/components/owner-admin/ui";
import {
  getOwnerPeople,
  getOwnerSeries,
  type OwnerPeople,
  type OwnerSeriesPoint,
} from "@/lib/owner-admin.functions";

export const Route = createFileRoute("/owner-admin/")({
  head: () => ({
    meta: [
      { title: "Owner overview — Attendance HQ" },
      { name: "description", content: "How many people are on Attendance HQ, and how many keep coming back." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: OwnerOverviewRoute,
});

const RANGES = [
  { key: "30", label: "30 days", days: 30, bucket: "day" as const },
  { key: "90", label: "90 days", days: 90, bucket: "week" as const },
  { key: "365", label: "12 months", days: 365, bucket: "month" as const },
];

function pct(part: number, whole: number): number {
  if (!whole) return 0;
  return (part / whole) * 100;
}

function OwnerOverviewRoute() {
  const isMobile = useIsMobile();
  const [rangeKey, setRangeKey] = React.useState("30");
  const range = RANGES.find((r) => r.key === rangeKey) ?? RANGES[0]!;

  const payload = React.useMemo(() => {
    const to = new Date();
    const from = new Date(to.getTime() - range.days * 86_400_000);
    return { from: from.toISOString(), to: to.toISOString(), bucket: range.bucket };
  }, [range]);

  const people = useAuthorizedQuery<OwnerPeople>(["owner-admin", "people"], getOwnerPeople, undefined, {
    staleTime: 60_000,
  });
  const series = useAuthorizedQuery<OwnerSeriesPoint[], typeof payload>(
    ["owner-admin", "series", payload.bucket, range.key],
    getOwnerSeries,
    payload,
    { staleTime: 60_000 },
  );

  if (people.isLoading) return <LoadingBlock />;
  if (people.isError || !people.data) return <ErrorBlock message={people.error?.message} />;

  const d = people.data;
  const totalPeople = d.members.total + d.hosts.total;
  const checkedInPct = pct(d.members.checkedIn, d.members.total);
  const repeatPct = pct(d.members.repeat, d.members.checkedIn);
  const returningPct = pct(d.returning.returnedThisMonth, d.returning.lastMonthAttendees);
  const monthDelta =
    d.checkIns.previousMonth > 0
      ? ((d.checkIns.thisMonth - d.checkIns.previousMonth) / d.checkIns.previousMonth) * 100
      : null;

  const chartData = (series.data ?? []).map((point) => ({
    ...point,
    label: formatBucket(point.bucket, range.bucket),
  }));

  return (
    <div className="mx-auto max-w-5xl animate-in fade-in duration-500">
      {/* Hero — the whole point of this page */}
      <section className="mb-6 rounded-[30px] border border-border/50 bg-gradient-to-b from-primary/[0.07] via-card to-card p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03),0_30px_60px_-40px_rgba(0,0,0,0.35)] sm:p-9">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">People on Attendance HQ</p>
        <h1 className="mt-1.5 font-display text-[22px] font-semibold tracking-tight">
          {fmtNumber(totalPeople)} people are on the app right now
        </h1>

        <div className="mt-6 grid gap-6 sm:mt-7 sm:grid-cols-3 sm:gap-4">
          <HeroStat
            value={fmtNumber(d.members.total)}
            label="Members"
            caption={`${fmtNumber(d.members.newThisMonth)} added this month`}
            emphasis
          />
          <HeroStat
            value={fmtNumber(d.hosts.total)}
            label="Host accounts"
            caption={`Running ${fmtNumber(d.hosts.organizations)} ${d.hosts.organizations === 1 ? "club" : "clubs"}`}
          />
          <HeroStat
            value={fmtNumber(d.checkIns.total)}
            label="Check-ins, all time"
            caption={`${fmtNumber(d.checkIns.thisMonth)} in ${d.checkIns.monthLabel}${
              monthDelta === null ? "" : ` (${monthDelta >= 0 ? "+" : ""}${monthDelta.toFixed(0)}% vs last month)`
            }`}
          />
        </div>

        <p className="mt-6 border-t border-border/50 pt-3 text-[12px] text-muted-foreground">
          Counted live from member, host account, club and check-in records — nothing is estimated or seeded.
        </p>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* 1. Have they checked in? */}
        <GlanceCard
          title="Have they checked in?"
          question="Of everyone in the app, how many have actually scanned in at least once."
          footnote="Members with one or more attendance records, out of all member records."
        >
          <div className="flex flex-wrap items-center gap-5 sm:gap-6">
            <StatRing
              percent={checkedInPct}
              centerLabel="have checked in"
              tone={CHART_COLORS[0]}
            />
            <div className="min-w-[9rem] space-y-3">
              <div>
                <p className="font-display text-[26px] font-semibold leading-none tabular-nums">
                  {fmtNumber(d.members.checkedIn)}
                </p>
                <p className="text-[13px] text-muted-foreground">members have checked in</p>
              </div>
              <div>
                <p className="font-display text-[26px] font-semibold leading-none tabular-nums text-muted-foreground">
                  {fmtNumber(Math.max(0, d.members.total - d.members.checkedIn))}
                </p>
                <p className="text-[13px] text-muted-foreground">have not checked in yet</p>
              </div>
            </div>
          </div>
        </GlanceCard>

        {/* 2. Do they come back? */}
        <GlanceCard
          title="Do they come back?"
          question="The share of people who checked in more than once — the sign the app is sticking."
          footnote="Repeat = members with two or more check-ins. Returning = last month's attendees who also checked in this month."
        >
          <p className="font-display text-[clamp(2.75rem,6vw,3.5rem)] font-semibold leading-none tracking-[-0.03em] tabular-nums text-primary">
            {Math.round(repeatPct)}%
          </p>
          <p className="mt-2 text-[14px] text-foreground">
            {fmtNumber(d.members.repeat)} of {fmtNumber(d.members.checkedIn)} people came back for a second meeting
          </p>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {d.returning.lastMonthAttendees === 0
              ? "No one checked in last month, so there is nothing to compare yet."
              : `${fmtNumber(d.returning.returnedThisMonth)} of last month's ${fmtNumber(
                  d.returning.lastMonthAttendees,
                )} attendees (${Math.round(returningPct)}%) came back this month`}
          </p>

          <div className="mt-6">
            <p className="mb-3 text-[13px] font-medium">How often people show up</p>
            {d.members.checkedIn === 0 ? (
              <EmptyState title="No check-ins recorded yet." />
            ) : (
              <PlainBars rows={d.frequency.map((f) => ({ label: f.label, value: f.people }))} />
            )}
          </div>
        </GlanceCard>

        {/* 3. Is it growing? */}
        <GlanceCard
          className="lg:col-span-2"
          title="Is it growing?"
          question="Check-ins recorded over time. Higher is better; flat means people stopped using it."
          footnote="Attendance records grouped by the time each person checked in."
        >
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <p className="text-[13px] text-muted-foreground">
              {fmtNumber(chartData.reduce((sum, p) => sum + (p.checkIns ?? 0), 0))} check-ins in the last{" "}
              {range.label.toLowerCase()}
            </p>
            <RangeSegmented
              value={rangeKey}
              onChange={setRangeKey}
              options={RANGES.map((r) => ({ key: r.key, label: r.label }))}
            />
          </div>

          {series.isLoading ? (
            <LoadingBlock label="Loading trend…" />
          ) : chartData.length === 0 ? (
            <EmptyState title="No check-ins in this window yet." />
          ) : (
            <TrendArea
              data={chartData}
              xKey="label"
              height={isMobile ? 200 : 260}
              series={[{ key: "checkIns", label: "Check-ins", color: CHART_COLORS[0] }]}
            />
          )}
        </GlanceCard>
      </div>

      <p className="mt-6 text-center text-[12px] text-muted-foreground">
        Need the detail?{" "}
        <Link to="/owner-admin/organizations" className="text-primary underline-offset-4 hover:underline">
          Organizations
        </Link>
        {" · "}
        <Link to="/owner-admin/attendance" className="text-primary underline-offset-4 hover:underline">
          Attendance
        </Link>
        {" · "}
        <Link to="/owner-admin/growth" className="text-primary underline-offset-4 hover:underline">
          Activation &amp; retention
        </Link>
      </p>
    </div>
  );
}

function formatBucket(value: string, bucket: "day" | "week" | "month"): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  if (bucket === "month") return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
