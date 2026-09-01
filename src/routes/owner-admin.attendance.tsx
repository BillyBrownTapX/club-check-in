// Owner Admin — attendance activity analytics.

import * as React from "react";
import { Link, createFileRoute } from "@tanstack/react-router";

import { useAuthorizedQuery } from "@/components/attendance-hq/auth-provider";
import {
  CHART_COLORS,
  DataTable,
  ErrorBlock,
  KpiCard,
  KpiGrid,
  LoadingBlock,
  PageHeading,
  RangeSegmented,
  SectionCard,
  SimpleBars,
  fmtDate,
  fmtNumber,
  fmtPercent,
} from "@/components/owner-admin/ui";
import { getOwnerAttendance, type OwnerAttendanceReport } from "@/lib/owner-admin.functions";

export const Route = createFileRoute("/owner-admin/attendance")({
  head: () => ({
    meta: [
      { title: "Attendance — Attendance HQ owner console" },
      { name: "description", content: "Check-in volume, methods and timing across the platform." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: OwnerAttendanceRoute,
});

const RANGES = [
  { key: "30", label: "30 days", days: 30 },
  { key: "90", label: "90 days", days: 90 },
  { key: "365", label: "12 months", days: 365 },
];

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function OwnerAttendanceRoute() {
  const [rangeKey, setRangeKey] = React.useState("90");
  const range = RANGES.find((r) => r.key === rangeKey) ?? RANGES[0]!;

  const payload = React.useMemo(() => {
    const to = new Date();
    const from = new Date(to.getTime() - range.days * 86_400_000);
    return { from: from.toISOString(), to: to.toISOString() };
  }, [range]);

  const report = useAuthorizedQuery<OwnerAttendanceReport, typeof payload>(
    ["owner-admin", "attendance", range.key],
    getOwnerAttendance,
    payload,
    { staleTime: 60_000 },
  );

  if (report.isLoading) return <LoadingBlock />;
  if (report.isError || !report.data) return <ErrorBlock message={report.error?.message} />;

  const m = report.data.metrics;
  const methodRows = Object.entries(m.methodBreakdown ?? {}).map(([method, count]) => ({ method, count }));
  const methodTotal = methodRows.reduce((sum, row) => sum + row.count, 0) || 1;

  return (
    <>
      <PageHeading
        eyebrow="Activity"
        title="Attendance activity"
        description="Where and how members actually check in — the strongest signal of real product usage."
        actions={
          <RangeSegmented
            value={rangeKey}
            onChange={setRangeKey}
            options={RANGES.map((r) => ({ key: r.key, label: r.label }))}
          />
        }
      />

      <KpiGrid>
        <KpiCard label={`Check-ins (last ${range.days}d)`} value={fmtNumber(m.inRange)} hint={`${fmtNumber(m.lifetime)} lifetime`} />
        <KpiCard label="Today / week / month" value={`${fmtNumber(m.today)} / ${fmtNumber(m.thisWeek)} / ${fmtNumber(m.thisMonth)}`} />
        <KpiCard label="Unique attendees" value={fmtNumber(m.uniqueAttendees)} hint={`${fmtPercent(m.repeatRate)} returned for a second event`} tone="good" />
        <KpiCard label="Avg per event" value={fmtNumber(m.avgPerEvent)} hint={`${fmtNumber(m.avgPerOrganization)} avg per organization`} />
      </KpiGrid>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <SectionCard title="Check-ins by day of week" description="When meetings actually happen" source="Attendance records in the selected range.">
          <SimpleBars
            data={report.data.byDayOfWeek.map((row) => ({ label: DAY_LABELS[row.day] ?? String(row.day), checkIns: row.checkIns }))}
            xKey="label"
            valueKey="checkIns"
            label="Check-ins"
          />
        </SectionCard>
        <SectionCard title="Check-ins by hour" description="Local server hour of check-in">
          <SimpleBars
            data={report.data.byHour.map((row) => ({ label: `${row.hour}:00`, checkIns: row.checkIns }))}
            xKey="label"
            valueKey="checkIns"
            label="Check-ins"
            color={CHART_COLORS[3]}
          />
        </SectionCard>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <SectionCard title="Check-in methods" description="How members identified themselves" source="Recorded check-in method on each attendance record.">
          <div className="space-y-3">
            {methodRows.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No check-ins yet.</p>
            ) : (
              methodRows.map((row) => (
                <div key={row.method}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="capitalize">{row.method.replace(/_/g, " ")}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {fmtNumber(row.count)} · {fmtPercent((row.count / methodTotal) * 100, 0)}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${(row.count / methodTotal) * 100}%` }} />
                  </div>
                </div>
              ))
            )}
            <div className="border-t border-border/60 pt-3 text-xs text-muted-foreground">
              Pre-event check-ins in range: <span className="font-medium text-foreground">{fmtNumber(m.preCheckIns)}</span>
              <br />
              Duplicate scan attempts: <span className="font-medium text-foreground">{fmtNumber(m.duplicateAttempts)}</span>
              <br />
              Failed check-in attempts: <span className="font-medium text-foreground">{fmtNumber(m.failedAttempts)}</span>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Top organizations" description="By check-ins in range">
          <DataTable
            rows={report.data.topOrganizations}
            rowKey={(row) => row.clubId}
            empty="No activity in range."
            columns={[
              {
                key: "name",
                header: "Organization",
                render: (row) => (
                  <Link
                    to="/owner-admin/organizations/$clubId"
                    params={{ clubId: row.clubId }}
                    className="text-primary hover:underline"
                  >
                    {row.name}
                  </Link>
                ),
              },
              { key: "checkins", header: "Check-ins", align: "right", render: (row) => fmtNumber(row.checkIns) },
            ]}
          />
        </SectionCard>

        <SectionCard title="Largest events" description="Biggest single-meeting turnout in range">
          <DataTable
            rows={report.data.largestEvents}
            rowKey={(row) => row.eventId}
            empty="No activity in range."
            columns={[
              { key: "name", header: "Event", render: (row) => row.name },
              { key: "date", header: "Date", render: (row) => fmtDate(row.date) },
              { key: "checkins", header: "Check-ins", align: "right", render: (row) => fmtNumber(row.checkIns) },
            ]}
          />
        </SectionCard>
      </div>
    </>
  );
}
