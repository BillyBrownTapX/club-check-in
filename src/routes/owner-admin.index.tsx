// Owner Admin — platform overview, North Star metric, and growth trends.

import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";

import { useAuthorizedQuery } from "@/components/attendance-hq/auth-provider";
import {
  CHART_COLORS,
  EmptyState,
  ErrorBlock,
  KpiCard,
  KpiGrid,
  LoadingBlock,
  PageHeading,
  SectionCard,
  TrendArea,
  TrendLine,
  fmtNumber,
  fmtPercent,
} from "@/components/owner-admin/ui";
import { Button } from "@/components/ui/button";
import {
  getOwnerOverview,
  getOwnerSeries,
  type OwnerOverview,
  type OwnerSeriesPoint,
} from "@/lib/owner-admin.functions";

export const Route = createFileRoute("/owner-admin/")({
  head: () => ({
    meta: [
      { title: "Owner overview — Attendance HQ" },
      { name: "description", content: "Platform-wide adoption and attendance activity." },
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

function OwnerOverviewRoute() {
  const [rangeKey, setRangeKey] = React.useState("30");
  const range = RANGES.find((r) => r.key === rangeKey) ?? RANGES[0]!;

  const payload = React.useMemo(() => {
    const to = new Date();
    const from = new Date(to.getTime() - range.days * 86_400_000);
    return { from: from.toISOString(), to: to.toISOString(), bucket: range.bucket };
  }, [range]);

  const overview = useAuthorizedQuery<OwnerOverview>(["owner-admin", "overview"], getOwnerOverview, undefined, {
    staleTime: 60_000,
  });
  const series = useAuthorizedQuery<OwnerSeriesPoint[], typeof payload>(
    ["owner-admin", "series", payload.bucket, range.key],
    getOwnerSeries,
    payload,
    { staleTime: 60_000 },
  );

  if (overview.isLoading) return <LoadingBlock />;
  if (overview.isError || !overview.data) return <ErrorBlock message={overview.error?.message} />;

  const d = overview.data;
  const nsDelta =
    d.northStar.previousMonth > 0
      ? ((d.northStar.currentMonth - d.northStar.previousMonth) / d.northStar.previousMonth) * 100
      : null;

  const chartData = (series.data ?? []).map((point) => ({
    ...point,
    label: formatBucket(point.bucket, range.bucket),
  }));

  return (
    <>
      <PageHeading
        eyebrow="Platform"
        title="Platform overview"
        description="Every organization, host, member, event and check-in across Attendance HQ."
        actions={
          <div className="flex gap-1 rounded-lg border border-border/60 p-1">
            {RANGES.map((r) => (
              <Button
                key={r.key}
                size="sm"
                variant={r.key === rangeKey ? "secondary" : "ghost"}
                onClick={() => setRangeKey(r.key)}
              >
                {r.label}
              </Button>
            ))}
          </div>
        }
      />

      <SectionCard
        title="North Star — check-ins recorded this month"
        description="The single number that proves the product is doing its job."
        source="Live count of attendance records created this calendar month, compared with last month."
        className="mb-5 bg-gradient-to-br from-primary/[0.06] to-transparent"
      >
        <div className="flex flex-wrap items-end gap-8">
          <div>
            <p className="font-display text-[44px] font-extrabold leading-none tabular-nums text-primary">
              {fmtNumber(d.northStar.currentMonth)}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">{d.northStar.monthLabel}</p>
          </div>
          <div className="text-sm">
            <p className="text-muted-foreground">Previous month</p>
            <p className="font-medium tabular-nums">{fmtNumber(d.northStar.previousMonth)}</p>
          </div>
          <div className="text-sm">
            <p className="text-muted-foreground">Change</p>
            <p
              className={
                nsDelta === null
                  ? "font-medium"
                  : nsDelta >= 0
                    ? "font-medium text-success"
                    : "font-medium text-destructive"
              }
            >
              {nsDelta === null ? "—" : `${nsDelta >= 0 ? "+" : ""}${nsDelta.toFixed(1)}%`}
            </p>
          </div>
        </div>
      </SectionCard>


      <div className="mb-5 space-y-2.5">
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Organizations</h2>
        <KpiGrid>
          <KpiCard label="Total" value={fmtNumber(d.organizations.total)} hint={`+${d.organizations.newThisMonth} this month`} />
          <KpiCard label="Active (30d)" value={fmtNumber(d.organizations.active30d)} hint={`${fmtNumber(d.organizations.active7d)} active in last 7 days`} tone="good" />
          <KpiCard label="At risk" value={fmtNumber(d.organizations.atRisk)} hint="No activity 14–30 days" tone="warn" />
          <KpiCard label="Dormant / never activated" value={`${fmtNumber(d.organizations.dormant)} / ${fmtNumber(d.organizations.neverActivated)}`} hint="Dormant = 60+ days idle" tone="bad" />
        </KpiGrid>
      </div>

      <div className="mb-5 space-y-2.5">
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">People &amp; activity</h2>
        <KpiGrid>
          <KpiCard label="Members tracked" value={fmtNumber(d.members.total)} hint={`${fmtNumber(d.members.avgPerOrganization)} avg per organization`} />
          <KpiCard label="Events created" value={fmtNumber(d.events.total)} hint={`${fmtNumber(d.events.thisMonth)} this month · ${fmtNumber(d.events.thisWeek)} this week`} />
          <KpiCard label="Check-ins (lifetime)" value={fmtNumber(d.attendance.total)} hint={`${fmtNumber(d.attendance.avgPerEvent)} avg per event`} />
          <KpiCard label="Unique attendees this month" value={fmtNumber(d.attendance.uniqueThisMonth)} hint={`${fmtNumber(d.attendance.today)} check-ins today`} />
        </KpiGrid>
        <p className="text-[11px] text-muted-foreground">
          Counted live from organizations, students, events and attendance records — no sample or seeded data.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard
          title="Check-in volume"
          description={`Per ${range.bucket}`}
          source="Attendance records grouped by check-in timestamp."
        >
          {series.isLoading ? (
            <LoadingBlock label="Loading trend…" />
          ) : chartData.length === 0 ? (
            <EmptyState title="No check-ins in this window yet." />
          ) : (
            <TrendArea
              data={chartData}
              xKey="label"
              series={[{ key: "checkIns", label: "Check-ins", color: CHART_COLORS[0] }]}
            />
          )}
        </SectionCard>
        <SectionCard
          title="Organization growth"
          description="New vs cumulative"
          source="Organization records grouped by creation date."
        >
          {series.isLoading ? (
            <LoadingBlock label="Loading trend…" />
          ) : chartData.length === 0 ? (
            <EmptyState title="No organizations created in this window." />
          ) : (
            <TrendLine
              data={chartData}
              xKey="label"
              series={[
                { key: "totalOrganizations", label: "Total organizations", color: CHART_COLORS[0] },
                { key: "newOrganizations", label: "New", color: CHART_COLORS[2] },
              ]}
            />
          )}
        </SectionCard>
        <SectionCard
          title="Events created"
          description={`Per ${range.bucket}`}
          source="Event records grouped by creation date."
        >
          {series.isLoading ? (
            <LoadingBlock label="Loading trend…" />
          ) : chartData.length === 0 ? (
            <EmptyState title="No events created in this window." />
          ) : (
            <TrendArea
              data={chartData}
              xKey="label"
              series={[{ key: "eventsCreated", label: "Events", color: CHART_COLORS[3] }]}
            />
          )}
        </SectionCard>
        <SectionCard
          title="Active organizations"
          description="Recorded at least one check-in in the bucket"
          source="Distinct organizations appearing in attendance records, plus new member records."
        >
          {series.isLoading ? (
            <LoadingBlock label="Loading trend…" />
          ) : chartData.length === 0 ? (
            <EmptyState title="No activity in this window yet." />
          ) : (
            <TrendLine
              data={chartData}
              xKey="label"
              series={[
                { key: "activeOrganizations", label: "Active organizations", color: CHART_COLORS[1] },
                { key: "newMembers", label: "New members", color: CHART_COLORS[4] },
              ]}
            />
          )}
        </SectionCard>
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        Member repeat coverage: {fmtPercent((d.members.withAttendance / Math.max(1, d.members.total)) * 100, 0)} of tracked
        members have at least one check-in.
      </p>

    </>
  );
}

function formatBucket(value: string, bucket: "day" | "week" | "month"): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  if (bucket === "month") return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
