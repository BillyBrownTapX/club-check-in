import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { ClubCard, ClubDialog, EmptyStateBlock, ManagementPageShell, PageHeader, PrimaryButton, useRequireHostRedirect } from "@/components/attendance-hq/host-management";
import type { ClubSummary } from "@/lib/attendance-hq";
import { getHostClubSummaries, createClubManagement } from "@/lib/attendance-hq.functions";
import { useServerFn } from "@tanstack/react-start";
import { useRouter as useInvalidateRouter } from "@tanstack/react-router";

function ClubsNotFound() {
  return <ManagementPageShell><div className="py-16 text-center text-sm text-muted-foreground">We couldn’t find your clubs.</div></ManagementPageShell>;
}

function ClubsError({ error }: { error: Error }) {
  return <ManagementPageShell><div className="py-16 text-center text-sm text-muted-foreground">{error.message}</div></ManagementPageShell>;
}

export const Route = createFileRoute("/clubs/")({
  head: () => ({
    meta: [
      { title: "Clubs — Attendance HQ" },
      { name: "description", content: "Manage the clubs and organizations you use to host events." },
    ],
  }),
  component: ClubsRoute,
});

function ClubsRoute() {
  const { loading, user } = useRequireHostRedirect();
  const getClubs = useServerFn(getHostClubSummaries);
  const createClub = useServerFn(createClubManagement);
  const router = useInvalidateRouter();
  const [open, setOpen] = useState(false);
  const [clubs, setClubs] = useState<ClubSummary[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading || !user) return;
    let cancelled = false;

    const load = async () => {
      setFetching(true);
      setError(null);
      try {
        const nextClubs = await getClubs();
        if (!cancelled) setClubs(nextClubs);
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Unable to load clubs.");
      } finally {
        if (!cancelled) setFetching(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [getClubs, loading, user]);

  if (loading || !user) return <ManagementPageShell><div className="py-16 text-center text-sm text-muted-foreground">Loading your clubs…</div></ManagementPageShell>;

  return (
    <ManagementPageShell>
      <div className="space-y-6 pb-20 md:pb-0">
        <PageHeader
          title="Clubs"
          description="Manage the clubs and organizations you use to host events."
          action={<PrimaryButton type="button" onClick={() => setOpen(true)}><Plus className="h-4 w-4" />Create Club</PrimaryButton>}
        />
        {fetching ? (
          <div className="py-16 text-center text-sm text-muted-foreground">Loading your clubs…</div>
        ) : error ? (
          <ClubsError error={new Error(error)} />
        ) : clubs.length ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {clubs.map((club: ClubSummary) => <ClubCard key={club.id} club={club} />)}
          </div>
        ) : (
          <EmptyStateBlock
            title="No clubs yet"
            description="Create your first club to start hosting events and tracking attendance."
            action={<PrimaryButton type="button" onClick={() => setOpen(true)}>Create Club</PrimaryButton>}
          />
        )}
        <ClubDialog
          open={open}
          onOpenChange={setOpen}
          title="Create Club"
          description="Add another club without leaving your workspace."
          onSubmit={async (values) => {
            await createClub({ data: values as never });
            await router.invalidate({ sync: true });
            setClubs(await getClubs());
          }}
        />
      </div>
    </ManagementPageShell>
  );
}
