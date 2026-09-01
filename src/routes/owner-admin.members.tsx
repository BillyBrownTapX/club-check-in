// Owner Admin — member (student) analytics across all organizations.

import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";

import { useAuthorizedQuery } from "@/components/attendance-hq/auth-provider";
import {
  DataTable,
  ErrorBlock,
  KpiCard,
  KpiGrid,
  LoadingBlock,
  PageHeading,
  Pager,
  SearchField,
  SectionCard,
  fmtDate,
  fmtNumber,
  fmtRelative,
} from "@/components/owner-admin/ui";
import { getOwnerMembers, type OwnerMembersReport } from "@/lib/owner-admin.functions";

export const Route = createFileRoute("/owner-admin/members")({
  head: () => ({
    meta: [
      { title: "Members — Attendance HQ owner console" },
      { name: "description", content: "Members tracked across every organization on the platform." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: OwnerMembersRoute,
});

const LIMIT = 25;

function OwnerMembersRoute() {
  const [search, setSearch] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [offset, setOffset] = React.useState(0);

  React.useEffect(() => {
    const id = setTimeout(() => {
      setDebounced(search.trim());
      setOffset(0);
    }, 300);
    return () => clearTimeout(id);
  }, [search]);

  const payload = React.useMemo(() => ({ q: debounced || undefined, limit: LIMIT, offset }), [debounced, offset]);

  const members = useAuthorizedQuery<OwnerMembersReport, typeof payload>(
    ["owner-admin", "members", payload],
    getOwnerMembers,
    payload,
    { staleTime: 30_000 },
  );

  const m = members.data?.metrics ?? {};

  return (
    <>
      <PageHeading
        eyebrow="Accounts"
        title="Members"
        description="People who have checked in at least once, or been added to an organization roster. Contact details stay inside the organizations that own them."
      />

      <KpiGrid>
        <KpiCard label="Members tracked" value={fmtNumber(m["total"])} hint={`+${fmtNumber(m["newThisMonth"])} this month`} />
        <KpiCard label="With attendance" value={fmtNumber(m["withAttendance"])} hint={`${fmtNumber(m["withoutAttendance"])} never attended`} tone="good" />
        <KpiCard label="Repeat attendees" value={fmtNumber(m["repeatAttendees"])} hint={`${fmtNumber(m["avgEventsPerMember"])} avg events per member`} />
        <KpiCard label="Avg per organization" value={fmtNumber(m["avgPerOrganization"])} hint={`+${fmtNumber(m["newThisWeek"])} this week`} />
      </KpiGrid>

      <SectionCard
        className="mt-4"
        title="All members"
        source="Live student records joined with their attendance and pre-check-in history."
        actions={<SearchField value={search} onChange={setSearch} placeholder="Search name or email…" />}
      >
        {members.isLoading ? (
          <LoadingBlock />
        ) : members.isError ? (
          <ErrorBlock message={members.error?.message} />
        ) : (
          <>
            <DataTable
              rows={members.data?.rows ?? []}
              rowKey={(row) => row.id}
              empty="No members match this search."
              mobile={{
                title: (row) => row.name,
                subtitle: (row) => row.email,
                stats: ["orgs", "events", "checkins", "last"],
              }}
              columns={[
                {
                  key: "name",
                  header: "Member",
                  render: (row) => (
                    <div className="min-w-[200px]">
                      <p className="font-medium">{row.name}</p>
                      <p className="text-xs text-muted-foreground">{row.email}</p>
                    </div>
                  ),
                },
                { key: "university", header: "University", render: (row) => row.university ?? "—" },
                { key: "orgs", header: "Organizations", align: "right", render: (row) => fmtNumber(row.organizations) },
                { key: "events", header: "Events attended", align: "right", render: (row) => fmtNumber(row.eventsAttended) },
                { key: "checkins", header: "Check-ins", align: "right", render: (row) => fmtNumber(row.checkIns) },
                { key: "last", header: "Last attendance", align: "right", render: (row) => fmtRelative(row.lastAttendance) },
                { key: "first", header: "First seen", align: "right", render: (row) => fmtDate(row.firstAttendance ?? row.createdAt) },
              ]}
            />
            <Pager total={members.data?.total ?? 0} limit={LIMIT} offset={offset} onOffset={setOffset} />
          </>
        )}
      </SectionCard>
    </>
  );
}
