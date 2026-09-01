// Owner Admin — feature adoption and system health.

import { createFileRoute } from "@tanstack/react-router";

import { useAuthorizedQuery } from "@/components/attendance-hq/auth-provider";
import {
  DataTable,
  ErrorBlock,
  KpiCard,
  KpiGrid,
  LoadingBlock,
  PageHeading,
  SectionCard,
  SimpleBars,
  fmtDate,
  fmtDateTime,
  fmtNumber,
  fmtPercent,
} from "@/components/owner-admin/ui";
import {
  getOwnerProductUsage,
  getOwnerSystemHealth,
  type OwnerProductUsageReport,
  type OwnerSystemHealthReport,
} from "@/lib/owner-admin.functions";

export const Route = createFileRoute("/owner-admin/product")({
  head: () => ({
    meta: [
      { title: "Product & health — Attendance HQ owner console" },
      { name: "description", content: "Feature adoption and platform health signals." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: OwnerProductRoute,
});

function OwnerProductRoute() {
  const usage = useAuthorizedQuery<OwnerProductUsageReport>(
    ["owner-admin", "product-usage"],
    getOwnerProductUsage,
    undefined,
    { staleTime: 60_000 },
  );
  const health = useAuthorizedQuery<OwnerSystemHealthReport>(
    ["owner-admin", "system-health"],
    getOwnerSystemHealth,
    undefined,
    { staleTime: 30_000 },
  );

  if (usage.isLoading || health.isLoading) return <LoadingBlock />;
  if (usage.isError || !usage.data) return <ErrorBlock message={usage.error?.message} />;
  if (health.isError || !health.data) return <ErrorBlock message={health.error?.message} />;

  const orgCount = Math.max(1, usage.data.organizationCount);
  const counts = health.data.counts;

  return (
    <>
      <PageHeading
        eyebrow="Activity"
        title="Product &amp; health"
        description="Which capabilities organizations actually adopt, and whether the platform is behaving."
      />

      <SectionCard title="Feature adoption" description={`Share of ${fmtNumber(usage.data.organizationCount)} organizations that have used each capability`}>
        <div className="space-y-3">
          {usage.data.features.map((feature) => {
            const pct = (feature.orgs / orgCount) * 100;
            return (
              <div key={feature.key}>
                <div className="flex items-center justify-between text-sm">
                  <span>{feature.label}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {fmtNumber(feature.orgs)} orgs · {fmtPercent(pct, 0)} · {fmtNumber(feature.total)} uses
                  </span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(1, Math.min(100, pct))}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>

      {usage.data.tracked.length > 0 ? (
        <SectionCard className="mt-4" title="Tracked feature events" description={`Telemetry since ${fmtDate(usage.data.trackingSince)}`}>
          <DataTable
            rows={usage.data.tracked}
            rowKey={(row) => row.key}
            empty="No tracked events yet."
            columns={[
              { key: "label", header: "Feature", render: (row) => row.label },
              { key: "orgs", header: "Organizations", align: "right", render: (row) => fmtNumber(row.orgs) },
              { key: "last7", header: "Last 7d", align: "right", render: (row) => fmtNumber(row.last7d) },
              { key: "last30", header: "Last 30d", align: "right", render: (row) => fmtNumber(row.last30d) },
              { key: "total", header: "Total", align: "right", render: (row) => fmtNumber(row.total) },
            ]}
          />
        </SectionCard>
      ) : null}

      <div className="mt-6 space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">System health</h2>
        <KpiGrid>
          <KpiCard
            label="Failed check-ins"
            value={fmtNumber(counts.checkInFailed)}
            hint={`${fmtNumber(counts.checkInFailed7d)} in last 7 days`}
            tone={counts.checkInFailed7d > 0 ? "warn" : "good"}
          />
          <KpiCard
            label="Server errors"
            value={fmtNumber(counts.serverErrors)}
            hint={`${fmtNumber(counts.serverErrors7d)} in last 7 days`}
            tone={counts.serverErrors7d > 0 ? "bad" : "good"}
          />
          <KpiCard label="Duplicate scans" value={fmtNumber(counts.duplicateCheckIn)} hint={`${fmtNumber(counts.rateLimited)} rate-limited requests`} />
          <KpiCard
            label="Rate-limit buckets active"
            value={fmtNumber(counts.activeRateLimitBuckets)}
            hint={`${fmtNumber(counts.expiredDeviceSessions)} expired device sessions pending cleanup`}
          />
        </KpiGrid>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <SectionCard title="Errors by day" description="Last 30 days of recorded failures">
          {health.data.errorsByDay.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No recorded errors.</p>
          ) : (
            <SimpleBars
              data={health.data.errorsByDay.map((row) => ({
                label: new Date(row.bucket).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
                errors: row.errors,
              }))}
              xKey="label"
              valueKey="errors"
              label="Errors"
              color="var(--destructive)"
            />
          )}
        </SectionCard>

        <SectionCard title="Recent incidents" description="Newest platform events (no member data recorded)" source="Live platform telemetry rows; historical metrics above are derived from application records.">
          <DataTable
            rows={health.data.recent}
            rowKey={(row) => row.id}
            empty="Nothing to report."
            columns={[
              { key: "at", header: "When", render: (row) => fmtDateTime(row.at) },
              { key: "type", header: "Type", render: (row) => <span className="capitalize">{row.type.replace(/_/g, " ")}</span> },
              { key: "org", header: "Organization", render: (row) => row.organization ?? "—" },
              {
                key: "meta",
                header: "Detail",
                render: (row) => (
                  <span className="text-xs text-muted-foreground">
                    {row.metadata ? JSON.stringify(row.metadata).slice(0, 80) : "—"}
                  </span>
                ),
              },
            ]}
          />
        </SectionCard>
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        Telemetry is PII-free: operation names, error codes and counts only.
        {health.data.trackingSince ? ` Collecting since ${fmtDate(health.data.trackingSince)}.` : ""}
      </p>
    </>
  );
}
