// Owner Admin — platform-wide event analytics.

import * as React from "react";
import { Link, createFileRoute } from "@tanstack/react-router";

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
} from "@/components/owner-admin/ui";
import { getOwnerEvents, type OwnerEventsReport } from "@/lib/owner-admin.functions";

export const Route = createFileRoute("/owner-admin/events")({
  head: () => ({
    meta: [
      { title: "Events — Attendance HQ owner console" },
      { name: "description", content: "Every event created on the platform with turnout." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: OwnerEventsRoute,
});

const LIMIT = 25;

function OwnerEventsRoute() {
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

  const events = useAuthorizedQuery<OwnerEventsReport, typeof payload>(
    ["owner-admin", "events", payload],
    getOwnerEvents,
    payload,
    { staleTime: 30_000 },
  );

  const m = events.data?.metrics;

  return (
    <>
      <PageHeading
        eyebrow="Activity"
        title="Events"
        description="Meeting cadence and turnout across every organization, including zero-attendance events worth a nudge."
      />

      <KpiGrid>
        <KpiCard label="Events created" value={fmtNumber(m?.total)} hint={`${fmtNumber(m?.thisMonth)} this month · ${fmtNumber(m?.thisWeek)} this week`} />
        <KpiCard label="Avg attendance" value={fmtNumber(m?.avgAttendance)} hint={`Median ${fmtNumber(m?.medianAttendance)}`} />
        <KpiCard label="Zero attendance" value={fmtNumber(m?.zeroAttendance)} hint="Events that recorded no check-ins" tone="warn" />
        <KpiCard label="Avg per organization" value={fmtNumber(m?.avgPerOrganization)} hint={m?.mostActiveOrganization ? `Most active: ${m.mostActiveOrganization.name}` : undefined} />
      </KpiGrid>

      {m?.largestEvent ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Largest single event: <span className="font-medium text-foreground">{m.largestEvent.name}</span> —{" "}
          {fmtNumber(m.largestEvent.checkIns)} check-ins on {fmtDate(m.largestEvent.date)}.
        </p>
      ) : null}

      <SectionCard
        className="mt-4"
        title="All events"
        actions={<SearchField value={search} onChange={setSearch} placeholder="Search event or organization…" />}
      >
        {events.isLoading ? (
          <LoadingBlock />
        ) : events.isError ? (
          <ErrorBlock message={events.error?.message} />
        ) : (
          <>
            <DataTable
              rows={events.data?.rows ?? []}
              rowKey={(row) => row.id}
              empty="No events match this search."
              columns={[
                {
                  key: "name",
                  header: "Event",
                  render: (row) => (
                    <div className="min-w-[200px]">
                      <p className="font-medium">{row.name}</p>
                      <Link
                        to="/owner-admin/organizations/$clubId"
                        params={{ clubId: row.clubId }}
                        className="text-xs text-primary hover:underline"
                      >
                        {row.organization}
                      </Link>
                    </div>
                  ),
                },
                { key: "date", header: "Date", render: (row) => fmtDate(row.date) },
                { key: "status", header: "Status", render: (row) => <span className="capitalize">{row.status}</span> },
                { key: "checkins", header: "Check-ins", align: "right", render: (row) => fmtNumber(row.checkIns) },
                { key: "unique", header: "Unique", align: "right", render: (row) => fmtNumber(row.uniqueAttendees) },
                { key: "pre", header: "Pre-check-ins", align: "right", render: (row) => fmtNumber(row.preCheckIns) },
                { key: "created", header: "Created", align: "right", render: (row) => fmtDate(row.createdAt) },
              ]}
            />
            <Pager total={events.data?.total ?? 0} limit={LIMIT} offset={offset} onOffset={setOffset} />
          </>
        )}
      </SectionCard>
    </>
  );
}
