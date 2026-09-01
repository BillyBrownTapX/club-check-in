// Owner Admin — platform user (host) analytics.

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
import { getOwnerUsers, type OwnerUsersReport } from "@/lib/owner-admin.functions";

export const Route = createFileRoute("/owner-admin/users")({
  head: () => ({
    meta: [
      { title: "Users — Attendance HQ owner console" },
      { name: "description", content: "Host accounts, activity and organization coverage." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: OwnerUsersRoute,
});

const LIMIT = 25;

function OwnerUsersRoute() {
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

  const payload = React.useMemo(
    () => ({ q: debounced || undefined, limit: LIMIT, offset }),
    [debounced, offset],
  );

  const users = useAuthorizedQuery<OwnerUsersReport, typeof payload>(
    ["owner-admin", "users", payload],
    getOwnerUsers,
    payload,
    { staleTime: 30_000 },
  );

  const m = users.data?.metrics ?? {};

  return (
    <>
      <PageHeading
        eyebrow="Accounts"
        title="Users"
        description="Everyone who has created an Attendance HQ account, with sign-in recency and organization coverage."
      />

      <KpiGrid>
        <KpiCard label="Total accounts" value={fmtNumber(m["total"])} hint={`+${fmtNumber(m["newThisWeek"])} this week`} />
        <KpiCard label="DAU / WAU / MAU" value={`${fmtNumber(m["dau"])} / ${fmtNumber(m["wau"])} / ${fmtNumber(m["mau"])}`} hint="Based on last sign-in" tone="good" />
        <KpiCard label="No organization" value={fmtNumber(m["withoutOrganization"])} hint="Signed up but never created or joined one" tone="warn" />
        <KpiCard label="Created org, never used" value={fmtNumber(m["createdOrgNeverUsed"])} hint={`${fmtNumber(m["disabled"])} disabled accounts`} tone="warn" />
      </KpiGrid>

      <SectionCard
        className="mt-4"
        title="All users"
        source="Live host accounts from the authentication system joined with their organization memberships."
        actions={<SearchField value={search} onChange={setSearch} placeholder="Search name or email…" />}
      >
        {users.isLoading ? (
          <LoadingBlock />
        ) : users.isError ? (
          <ErrorBlock message={users.error?.message} />
        ) : (
          <>
            <DataTable
              rows={users.data?.rows ?? []}
              rowKey={(row) => row.id}
              empty="No users match this search."
              mobile={{
                title: (row) => row.name,
                subtitle: (row) => row.email,
                stats: ["orgs", "roles", "events", "signin"],
              }}
              columns={[
                {
                  key: "name",
                  header: "User",
                  render: (row) => (
                    <div className="min-w-[200px]">
                      <p className="font-medium">
                        {row.name}
                        {row.isStaffAdmin ? (
                          <span className="ml-2 rounded bg-primary/12 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                            staff
                          </span>
                        ) : null}
                        {row.isDisabled ? (
                          <span className="ml-2 rounded bg-destructive/12 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
                            disabled
                          </span>
                        ) : null}
                      </p>
                      <p className="text-xs text-muted-foreground">{row.email}</p>
                    </div>
                  ),
                },
                { key: "orgs", header: "Organizations", align: "right", render: (row) => fmtNumber(row.organizations) },
                { key: "roles", header: "Roles", render: (row) => row.roles || "—" },
                { key: "events", header: "Events created", align: "right", render: (row) => fmtNumber(row.eventsCreated) },
                { key: "signin", header: "Last sign-in", align: "right", render: (row) => fmtRelative(row.lastSignInAt) },
                { key: "created", header: "Joined", align: "right", render: (row) => fmtDate(row.createdAt) },
              ]}
            />
            <Pager total={users.data?.total ?? 0} limit={LIMIT} offset={offset} onOffset={setOffset} />
          </>
        )}
      </SectionCard>
    </>
  );
}
