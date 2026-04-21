import { useEffect, useMemo, useState } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { Plus, Search } from "lucide-react";
import { useAuthorizedServerFn } from "@/components/attendance-hq/auth-provider";
import { HostAppShell } from "@/components/attendance-hq/host-shell";
import { ClubDialog, useRequireHostRedirect, getManagementErrorMessage } from "@/components/attendance-hq/host-management";
import { Chip, IosSearchField, LargeTitleHeader, SectionLabel } from "@/components/attendance-hq/ios";
import { Button } from "@/components/ui/button";
import { getHostClubSummaries, createClubManagement, getUniversitiesForHost } from "@/lib/attendance-hq.functions";
import type { ClubSummary, University } from "@/lib/attendance-hq";

export const Route = createFileRoute("/clubs/")({
  head: () => ({
    meta: [
      { title: "Clubs — Attendance HQ" },
      { name: "description", content: "Manage your clubs and organizations." },
    ],
  }),
  component: ClubsRoute,
});

function ClubsRoute() {
  const { loading, user } = useRequireHostRedirect();
  const getClubs = useAuthorizedServerFn(getHostClubSummaries);
  const getUniversities = useAuthorizedServerFn(getUniversitiesForHost);
  const createClub = useAuthorizedServerFn(createClubManagement);
  const [open, setOpen] = useState(false);
  const [clubs, setClubs] = useState<ClubSummary[]>([]);
  const [universities, setUniversities] = useState<University[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (loading || !user) return;
    let cancelled = false;
    setFetching(true);
    setError(null);
    void Promise.all([getClubs(), getUniversities()])
      .then(([nextClubs, nextUniversities]) => {
        if (cancelled) return;
        setClubs(nextClubs);
        setUniversities(nextUniversities);
      })
      .catch((e) => { if (!cancelled) setError(getManagementErrorMessage(e, "Unable to load clubs.")); })
      .finally(() => { if (!cancelled) setFetching(false); });
    return () => { cancelled = true; };
  }, [getClubs, getUniversities, loading, user]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clubs;
    return clubs.filter((c) => [c.club_name, c.universities?.name, c.description].filter(Boolean).join(" ").toLowerCase().includes(q));
  }, [clubs, query]);

  if (loading || !user) return <HostAppShell><div className="py-16 text-center text-sm text-muted-foreground">Loading…</div></HostAppShell>;

  return (
    <HostAppShell>
      <LargeTitleHeader
        title="Clubs"
        subtitle="Your organizations and university chapters."
        trailing={
          <Button variant="hero" size="sm" className="rounded-full" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> New
          </Button>
        }
      />

      <div className="mt-1">
        <IosSearchField value={query} onChange={setQuery} placeholder="Search clubs" />
      </div>

      <div className="mt-5">
        {fetching ? (
          <div className="ios-card rounded-3xl p-6 text-center text-sm text-muted-foreground">Loading…</div>
        ) : error ? (
          <div className="ios-card rounded-3xl p-6 text-center text-sm text-muted-foreground">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="ios-card rounded-3xl p-8 text-center">
            <p className="font-display text-[18px] font-bold text-foreground">No clubs yet</p>
            <p className="mt-1 text-[13px] text-muted-foreground">Create your first club to start hosting events.</p>
            <Button variant="hero" className="mt-5" onClick={() => setOpen(true)}>Create club</Button>
          </div>
        ) : (
          <>
            <SectionLabel>{filtered.length} {filtered.length === 1 ? "club" : "clubs"}</SectionLabel>
            <div className="space-y-3">
              {filtered.map((club) => <ClubRowCard key={club.id} club={club} />)}
            </div>
          </>
        )}
      </div>

      <ClubDialog
        open={open}
        onOpenChange={setOpen}
        universities={universities}
        title="Create Club"
        description="Add a new club to your workspace."
        onSubmit={async (values) => {
          await createClub({ data: values as never });
          setClubs(await getClubs());
        }}
      />
    </HostAppShell>
  );
}

function ClubRowCard({ club }: { club: ClubSummary }) {
  const initials = club.club_name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");
  const logoUrl = useSignedLogoUrl(club.logo_url ?? null);
  return (
    <Link to="/clubs/$clubId" params={{ clubId: club.id }} className="ios-card ios-press flex items-center gap-4 rounded-2xl p-4">
      <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-brand font-display text-[15px] font-extrabold text-primary-foreground">
        {logoUrl ? (
          <img src={logoUrl} alt={`${club.club_name} logo`} className="h-full w-full object-cover" />
        ) : (
          <span>{initials || "C"}</span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate font-display text-[16px] font-bold text-foreground">{club.club_name}</p>
          {club.is_active ? null : <Chip tone="muted">Inactive</Chip>}
        </div>
        <p className="mt-0.5 truncate text-[12.5px] text-muted-foreground">{club.universities?.name ?? "University needed"}</p>
        <div className="mt-1 flex gap-3 text-[12px] text-muted-foreground">
          <span>{club.upcomingEventsCount} upcoming</span>
          <span>·</span>
          <span>{club.totalCheckIns} check-ins</span>
        </div>
      </div>
    </Link>
  );
}
