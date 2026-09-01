// Owner Admin — searchable, filterable organization list with health scores.

import * as React from "react";
import { Link, createFileRoute } from "@tanstack/react-router";

import { useAuthorizedQuery } from "@/components/attendance-hq/auth-provider";
import {
  DataTable,
  ErrorBlock,
  HealthBar,
  KpiCard,
  KpiGrid,
  LoadingBlock,
  PageHeading,
  Pager,
  SearchField,
  SectionCard,
  StatusPill,
  fmtDate,
  fmtNumber,
  fmtRelative,
} from "@/components/owner-admin/ui";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ORG_STATUSES, ORG_STATUS_LABELS, type OrgStatus } from "@/lib/owner-admin-schemas";
import {
  listOwnerOrganizations,
  listOwnerUniversities,
  type OwnerOrgPage,
  type OwnerOrgRow,
} from "@/lib/owner-admin.functions";

export const Route = createFileRoute("/owner-admin/organizations/")({
  head: () => ({
    meta: [
      { title: "Organizations — Attendance HQ owner console" },
      { name: "description", content: "Every organization on Attendance HQ with adoption health." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: OwnerOrganizationsRoute,
});

const SORTS = [
  { value: "last_activity", label: "Last activity" },
  { value: "health", label: "Health score" },
  { value: "checkins", label: "Check-ins" },
  { value: "events", label: "Events" },
  { value: "members", label: "Members" },
  { value: "created", label: "Created" },
  { value: "name", label: "Name" },
] as const;

const LIMIT = 25;

function OwnerOrganizationsRoute() {
  const [search, setSearch] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [status, setStatus] = React.useState<"all" | OrgStatus>("all");
  const [universityId, setUniversityId] = React.useState("all");
  const [sort, setSort] = React.useState<(typeof SORTS)[number]["value"]>("last_activity");
  const [dir, setDir] = React.useState<"asc" | "desc">("desc");
  const [offset, setOffset] = React.useState(0);

  React.useEffect(() => {
    const id = setTimeout(() => {
      setDebounced(search.trim());
      setOffset(0);
    }, 300);
    return () => clearTimeout(id);
  }, [search]);

  const payload = React.useMemo(
    () => ({
      q: debounced || undefined,
      status,
      universityId: universityId === "all" ? undefined : universityId,
      sort,
      dir,
      limit: LIMIT,
      offset,
    }),
    [debounced, status, universityId, sort, dir, offset],
  );

  const orgs = useAuthorizedQuery<OwnerOrgPage, typeof payload>(
    ["owner-admin", "organizations", payload],
    listOwnerOrganizations,
    payload,
    { staleTime: 30_000 },
  );

  const universities = useAuthorizedQuery<{ id: string; name: string }[]>(
    ["owner-admin", "universities"],
    listOwnerUniversities,
    undefined,
    { staleTime: 600_000 },
  );

  const rows = orgs.data?.rows ?? [];
  const summary = React.useMemo(() => {
    const active = rows.filter((r) => r.days_since_activity <= 30).length;
    const avgHealth = rows.length
      ? Math.round(rows.reduce((sum, r) => sum + r.health_score, 0) / rows.length)
      : 0;
    return { active, avgHealth };
  }, [rows]);

  return (
    <>
      <PageHeading
        title="Organizations"
        description="Clubs and departments using Attendance HQ, scored on recency, event cadence, volume, admin engagement and feature adoption."
      />

      <KpiGrid>
        <KpiCard label="Matching organizations" value={fmtNumber(orgs.data?.total ?? 0)} />
        <KpiCard label="Active on this page (30d)" value={fmtNumber(summary.active)} tone="good" />
        <KpiCard label="Avg health on this page" value={summary.avgHealth || "—"} />
        <KpiCard label="Page" value={`${Math.floor(offset / LIMIT) + 1}`} hint={`${LIMIT} per page`} />
      </KpiGrid>

      <SectionCard
        className="mt-4"
        title="All organizations"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <SearchField value={search} onChange={setSearch} placeholder="Search name, owner, university…" />
            <Select value={status} onValueChange={(v) => { setStatus(v as "all" | OrgStatus); setOffset(0); }}>
              <SelectTrigger className="h-9 w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {ORG_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {ORG_STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={universityId} onValueChange={(v) => { setUniversityId(v); setOffset(0); }}>
              <SelectTrigger className="h-9 w-[190px]">
                <SelectValue placeholder="University" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All universities</SelectItem>
                {(universities.data ?? []).map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={(v) => setSort(v as typeof sort)}>
              <SelectTrigger className="h-9 w-[160px]">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                {SORTS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => setDir(dir === "desc" ? "asc" : "desc")}>
              {dir === "desc" ? "Desc" : "Asc"}
            </Button>
          </div>
        }
      >
        {orgs.isLoading ? (
          <LoadingBlock />
        ) : orgs.isError ? (
          <ErrorBlock message={orgs.error?.message} />
        ) : (
          <>
            <DataTable<OwnerOrgRow>
              rows={rows}
              rowKey={(row) => row.club_id}
              empty="No organizations match these filters."
              columns={[
                {
                  key: "name",
                  header: "Organization",
                  render: (row) => (
                    <div className="min-w-[180px]">
                      <Link
                        to="/owner-admin/organizations/$clubId"
                        params={{ clubId: row.club_id }}
                        className="font-medium text-primary hover:underline"
                      >
                        {row.club_name}
                      </Link>
                      <p className="text-xs text-muted-foreground">{row.university_name ?? "No university"}</p>
                    </div>
                  ),
                },
                {
                  key: "owner",
                  header: "Owner",
                  render: (row) => (
                    <div className="min-w-[150px]">
                      <p>{row.owner_name ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">{row.owner_email ?? "—"}</p>
                    </div>
                  ),
                },
                { key: "status", header: "Status", render: (row) => <StatusPill status={row.status} /> },
                { key: "health", header: "Health", render: (row) => <HealthBar score={row.health_score} /> },
                { key: "members", header: "Members", align: "right", render: (row) => fmtNumber(row.member_count) },
                { key: "events", header: "Events", align: "right", render: (row) => fmtNumber(row.event_count) },
                {
                  key: "checkins",
                  header: "Check-ins",
                  align: "right",
                  render: (row) => (
                    <div>
                      <p>{fmtNumber(row.checkins_total)}</p>
                      <p className="text-xs text-muted-foreground">{fmtNumber(row.checkins_30d)} in 30d</p>
                    </div>
                  ),
                },
                { key: "activity", header: "Last activity", align: "right", render: (row) => fmtRelative(row.last_activity) },
                { key: "created", header: "Created", align: "right", render: (row) => fmtDate(row.created_at) },
              ]}
            />
            <Pager total={orgs.data?.total ?? 0} limit={LIMIT} offset={offset} onOffset={setOffset} />
          </>
        )}
      </SectionCard>
    </>
  );
}
