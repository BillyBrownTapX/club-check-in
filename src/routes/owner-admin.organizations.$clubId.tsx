// Owner Admin — single organization profile: adoption, health breakdown,
// administrators, recent events and a lifecycle timeline.

import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { useAuthorizedQuery } from "@/components/attendance-hq/auth-provider";
import {
  DataTable,
  ErrorBlock,
  HealthBar,
  KpiCard,
  KpiGrid,
  LoadingBlock,
  PageHeading,
  SectionCard,
  StatusPill,
  fmtDate,
  fmtDateTime,
  fmtNumber,
  fmtRelative,
} from "@/components/owner-admin/ui";
import { Button } from "@/components/ui/button";
import { HEALTH_WEIGHTS } from "@/lib/owner-admin-schemas";
import { getOwnerOrganizationDetail, type OwnerOrgDetail } from "@/lib/owner-admin.functions";

export const Route = createFileRoute("/owner-admin/organizations/$clubId")({
  head: () => ({
    meta: [
      { title: "Organization profile — Attendance HQ owner console" },
      { name: "description", content: "Adoption, health and lifecycle detail for one organization." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: OwnerOrganizationDetailRoute,
});

function OwnerOrganizationDetailRoute() {
  const { clubId } = Route.useParams();
  const payload = { clubId };

  const detail = useAuthorizedQuery<OwnerOrgDetail, typeof payload>(
    ["owner-admin", "organization", clubId],
    getOwnerOrganizationDetail,
    payload,
    { staleTime: 30_000 },
  );

  if (detail.isLoading) return <LoadingBlock />;
  if (detail.isError || !detail.data) return <ErrorBlock message={detail.error?.message} />;

  const { stats, administrators, recentEvents, timeline } = detail.data;

  const scoreRows = [
    { label: "Recency of activity", weight: HEALTH_WEIGHTS.recency, score: stats.score_recency },
    { label: "Event frequency", weight: HEALTH_WEIGHTS.eventFrequency, score: stats.score_event_frequency },
    { label: "Attendance volume", weight: HEALTH_WEIGHTS.volume, score: stats.score_volume },
    { label: "Admin engagement", weight: HEALTH_WEIGHTS.adminEngagement, score: stats.score_admin },
    { label: "Feature adoption", weight: HEALTH_WEIGHTS.featureAdoption, score: stats.score_features },
  ];

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
        <Link to="/owner-admin/organizations">
          <ArrowLeft className="mr-1 size-4" /> All organizations
        </Link>
      </Button>

      <PageHeading
        title={stats.club_name}
        description={`${stats.university_name ?? "No university"} · created ${fmtDate(stats.created_at)} · ${
          stats.is_active ? "active" : "deactivated"
        }`}
        actions={
          <div className="flex items-center gap-3">
            <StatusPill status={stats.status} />
            <HealthBar score={stats.health_score} />
          </div>
        }
      />

      <KpiGrid>
        <KpiCard label="Members tracked" value={fmtNumber(stats.member_count)} hint={`${fmtNumber(stats.members_new_30d)} new in 30d`} />
        <KpiCard label="Events created" value={fmtNumber(stats.event_count)} hint={`${fmtNumber(stats.events_30d)} in last 30d`} />
        <KpiCard label="Check-ins" value={fmtNumber(stats.checkins_total)} hint={`${fmtNumber(stats.checkins_30d)} in last 30d`} />
        <KpiCard
          label="Repeat attendees"
          value={fmtNumber(stats.repeat_attendees)}
          hint={`${fmtNumber(stats.unique_attendees)} unique attendees`}
        />
      </KpiGrid>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <SectionCard title="Health breakdown" description="Weighted 0–100 adoption score">
          <div className="space-y-3">
            {scoreRows.map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm">{row.label}</p>
                  <p className="text-xs text-muted-foreground">{Math.round(row.weight * 100)}% of score</p>
                </div>
                <HealthBar score={row.score} />
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Lifecycle" description="Key adoption timestamps">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <Fact label="First event created" value={fmtDate(stats.first_event_created_at)} />
            <Fact label="Second event created" value={fmtDate(stats.second_event_created_at)} />
            <Fact label="First check-in" value={fmtDate(stats.first_checkin_at)} />
            <Fact label="Last check-in" value={fmtRelative(stats.last_checkin_at)} />
            <Fact label="Last event date" value={fmtDate(stats.last_event_date)} />
            <Fact label="Next scheduled event" value={fmtDate(stats.next_event_date)} />
            <Fact label="Last admin sign-in" value={fmtRelative(stats.last_admin_sign_in)} />
            <Fact label="Features used" value={`${stats.feature_count} of 5`} />
          </dl>
        </SectionCard>
      </div>

      <SectionCard className="mt-4" title="Administrators" description="Owners and officers with dashboard access">
        <DataTable
          rows={administrators}
          rowKey={(row) => row.userId}
          empty="No administrators."
          columns={[
            { key: "name", header: "Name", render: (row) => row.name ?? "—" },
            { key: "email", header: "Email", render: (row) => row.email ?? "—" },
            { key: "role", header: "Role", render: (row) => <span className="capitalize">{row.role}</span> },
            { key: "added", header: "Added", align: "right", render: (row) => fmtDate(row.addedAt) },
            { key: "signin", header: "Last sign-in", align: "right", render: (row) => fmtRelative(row.lastSignInAt) },
          ]}
        />
      </SectionCard>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <SectionCard title="Recent events" description="Newest 10 events with turnout">
          <DataTable
            rows={recentEvents}
            rowKey={(row) => row.id}
            empty="No events yet."
            columns={[
              { key: "name", header: "Event", render: (row) => row.name },
              { key: "date", header: "Date", render: (row) => fmtDate(row.date) },
              { key: "checkins", header: "Check-ins", align: "right", render: (row) => fmtNumber(row.checkIns) },
              { key: "pre", header: "Pre-check-ins", align: "right", render: (row) => fmtNumber(row.preCheckIns) },
            ]}
          />
        </SectionCard>

        <SectionCard title="Activity timeline" description="Most recent platform milestones">
          {timeline.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No recorded activity.</p>
          ) : (
            <ol className="space-y-3">
              {timeline.map((item, index) => (
                <li key={`${item.at}-${index}`} className="flex gap-3">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                  <div>
                    <p className="text-sm">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{fmtDateTime(item.at)}</p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </SectionCard>
      </div>
    </>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
