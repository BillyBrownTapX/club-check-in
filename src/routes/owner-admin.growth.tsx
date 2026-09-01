// Owner Admin — activation funnel and retention / cohort analysis.

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
  fmtDate,
  fmtDays,
  fmtNumber,
  fmtPercent,
} from "@/components/owner-admin/ui";
import {
  getOwnerActivation,
  getOwnerRetention,
  type OwnerActivationReport,
  type OwnerRetentionReport,
} from "@/lib/owner-admin.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/owner-admin/growth")({
  head: () => ({
    meta: [
      { title: "Activation & retention — Attendance HQ owner console" },
      { name: "description", content: "Signup-to-value funnel, stalled accounts and cohort retention." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: OwnerGrowthRoute,
});

function OwnerGrowthRoute() {
  const activation = useAuthorizedQuery<OwnerActivationReport>(
    ["owner-admin", "activation"],
    getOwnerActivation,
    undefined,
    { staleTime: 60_000 },
  );
  const retention = useAuthorizedQuery<OwnerRetentionReport>(
    ["owner-admin", "retention"],
    getOwnerRetention,
    undefined,
    { staleTime: 60_000 },
  );

  if (activation.isLoading || retention.isLoading) return <LoadingBlock />;
  if (activation.isError || !activation.data) return <ErrorBlock message={activation.error?.message} />;
  if (retention.isError || !retention.data) return <ErrorBlock message={retention.error?.message} />;

  const a = activation.data;
  const r = retention.data.metrics;
  const funnelTop = a.funnel[0]?.count ?? 0;

  return (
    <>
      <PageHeading
        eyebrow="Platform"
        title="Activation &amp; retention"
        description="How quickly new accounts reach real value — and whether they keep coming back."
      />

      <KpiGrid>
        <KpiCard label="Activation rate" value={fmtPercent(a.activationRate)} hint="Organizations that reached a first check-in" tone="good" />
        <KpiCard label="Signup → organization" value={fmtDays(a.timings.signupToOrganizationDays)} hint="Median time" />
        <KpiCard label="Organization → first check-in" value={fmtDays(a.timings.organizationToFirstCheckInDays)} hint={`First → second event: ${fmtDays(a.timings.firstToSecondEventDays)}`} />
        <KpiCard label="Never activated" value={fmtNumber(a.neverActivated.length)} hint={`${fmtNumber(a.stalled.length)} stalled mid-funnel`} tone="warn" />
      </KpiGrid>

      <SectionCard className="mt-4" title="Activation funnel" description="Accounts reaching each milestone" source="Counted live from host accounts, organizations, events and attendance records.">
        <div className="space-y-2">
          {a.funnel.map((stage) => {
            const pct = funnelTop > 0 ? (stage.count / funnelTop) * 100 : 0;
            return (
              <div key={stage.stage}>
                <div className="flex items-center justify-between text-sm">
                  <span>{stage.stage}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {fmtNumber(stage.count)} · {fmtPercent(pct, 0)}
                  </span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(1, pct)}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <SectionCard title="Never activated" description="Created an organization but recorded no check-ins">
          <DataTable
            rows={a.neverActivated}
            rowKey={(row) => row.clubId}
            empty="Every organization has activated."
            columns={[
              {
                key: "name",
                header: "Organization",
                render: (row) => (
                  <div>
                    <p className="font-medium">{row.name}</p>
                    <p className="text-xs text-muted-foreground">{row.ownerEmail ?? row.owner ?? "—"}</p>
                  </div>
                ),
              },
              { key: "events", header: "Events", align: "right", render: (row) => fmtNumber(row.events) },
              { key: "members", header: "Members", align: "right", render: (row) => fmtNumber(row.members) },
              { key: "created", header: "Created", align: "right", render: (row) => fmtDate(row.createdAt) },
            ]}
          />
        </SectionCard>

        <SectionCard title="Stalled mid-funnel" description="Reached one milestone but not the next">
          <DataTable
            rows={a.stalled}
            rowKey={(row) => row.clubId}
            empty="Nothing stalled."
            columns={[
              {
                key: "name",
                header: "Organization",
                render: (row) => (
                  <div>
                    <p className="font-medium">{row.name}</p>
                    <p className="text-xs text-muted-foreground">{row.ownerEmail ?? row.owner ?? "—"}</p>
                  </div>
                ),
              },
              { key: "reason", header: "Blocked at", render: (row) => row.reason },
              { key: "events", header: "Events", align: "right", render: (row) => fmtNumber(row.events) },
              { key: "created", header: "Created", align: "right", render: (row) => fmtDate(row.createdAt) },
            ]}
          />
        </SectionCard>
      </div>

      <div className="mt-4 space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">Retention</h2>
        <KpiGrid>
          <KpiCard label="Active 7d / 30d" value={`${fmtPercent(r.retained7d, 0)} / ${fmtPercent(r.retained30d, 0)}`} hint="Share of activated organizations" tone="good" />
          <KpiCard label="Active 60d / 90d" value={`${fmtPercent(r.retained60d, 0)} / ${fmtPercent(r.retained90d, 0)}`} />
          <KpiCard label="At risk / dormant" value={`${fmtNumber(r.atRisk)} / ${fmtNumber(r.dormant)}`} hint={`${fmtNumber(r.reactivated)} reactivated recently`} tone="warn" />
          <KpiCard label="Avg days between events" value={fmtDays(r.avgDaysBetweenEvents)} hint="Meeting cadence" />
        </KpiGrid>
      </div>

      <SectionCard className="mt-4" title="Cohort retention" description="Organizations grouped by signup month; each cell is the share still active that month" source="Activity derived from real check-in timestamps per organization.">
        {retention.data.cohorts.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Not enough history yet.</p>
        ) : (
          <div className="-mx-4 overflow-x-auto px-4">
            <table className="min-w-[640px] border-collapse text-sm">
              <thead>
                <tr>
                  <th className="px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Cohort
                  </th>
                  <th className="px-2 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Size
                  </th>
                  {[0, 1, 2, 3, 4, 5].map((offset) => (
                    <th
                      key={offset}
                      className="px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
                    >
                      M{offset}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {retention.data.cohorts.map((cohort) => (
                  <tr key={cohort.cohort} className="border-t border-border/40">
                    <td className="px-2 py-2 whitespace-nowrap">{formatCohort(cohort.cohort)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{fmtNumber(cohort.size)}</td>
                    {[0, 1, 2, 3, 4, 5].map((offset) => {
                      const cell = cohort.months?.find((m) => m.offset === offset);
                      if (!cell) return <td key={offset} className="px-2 py-2 text-center text-muted-foreground">—</td>;
                      return (
                        <td key={offset} className="px-1 py-1 text-center">
                          <span
                            className={cn(
                              "inline-block w-full rounded px-1.5 py-1 text-xs tabular-nums",
                              cell.retained >= 70
                                ? "bg-success/20 text-success"
                                : cell.retained >= 35
                                  ? "bg-warning/18 text-warning"
                                  : "bg-destructive/12 text-destructive",
                            )}
                          >
                            {Math.round(cell.retained)}%
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </>
  );
}

function formatCohort(value: string): string {
  const d = new Date(value.length === 7 ? `${value}-01T00:00:00Z` : value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}
