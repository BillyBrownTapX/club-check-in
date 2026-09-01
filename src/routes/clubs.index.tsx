import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Link, createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useAuthorizedMutation, useAuthorizedQuery } from "@/components/attendance-hq/auth-provider";
import { HostAppShell } from "@/components/attendance-hq/host-shell";
import { ClubDialog, useRequireHostRedirect, getManagementErrorMessage } from "@/components/attendance-hq/host-management";
import { Chip, IosSearchField, LargeTitleHeader, SectionLabel } from "@/components/attendance-hq/ios";
import { Button } from "@/components/ui/button";
import { getHostClubSummaries, createClubManagement, getUniversitiesForHost } from "@/lib/attendance-hq.functions";
import { useSignedLogoUrl } from "@/hooks/use-signed-logo";
import { clearFirstRun, isFirstRunActive } from "@/lib/host-first-run";
import type { ClubSummary } from "@/lib/attendance-hq";
import { queryKeys } from "@/lib/query-keys";


function ClubsError({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  return (
    <HostAppShell>
      <div className="ios-card mt-6 rounded-3xl p-6 text-center">
        <p className="text-sm text-destructive">{getManagementErrorMessage(error, "Unable to load clubs.")}</p>
        <Button className="mt-4" variant="hero" onClick={() => { router.invalidate(); reset(); }}>Try again</Button>
      </div>
    </HostAppShell>
  );
}

export const Route = createFileRoute("/clubs/")({
  head: () => ({
    meta: [
      { title: "Clubs — Attendance HQ" },
      { name: "description", content: "Manage your clubs and organizations." },
      { property: "og:title", content: "Clubs — Attendance HQ" },
      { property: "og:description", content: "Manage your clubs and organizations." },
      { name: "twitter:title", content: "Clubs — Attendance HQ" },
      { name: "twitter:description", content: "Manage your clubs and organizations." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ClubsRoute,
  errorComponent: ClubsError,
});

function ClubsRoute() {
  const { loading, user } = useRequireHostRedirect();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [guided, setGuided] = useState(false);
  const createdRef = useRef(false);

  // Brand-new accounts arrive here from sign-up with the create sheet open.
  useEffect(() => {
    if (loading || !user) return;
    if (isFirstRunActive(user.id)) {
      setGuided(true);
      setOpen(true);
    }
  }, [loading, user]);



  const clubsQuery = useAuthorizedQuery(
    queryKeys.clubs.summaries(),
    getHostClubSummaries,
    undefined,
    { staleTime: 30_000 },
  );
  const universitiesQuery = useAuthorizedQuery(
    queryKeys.universities.forHost(),
    getUniversitiesForHost,
    undefined,
    { staleTime: 5 * 60_000 },
  );
  const createClub = useAuthorizedMutation(createClubManagement, {
    invalidate: [queryKeys.clubs.all],
  });

  const clubs = clubsQuery.data ?? [];
  const universities = universitiesQuery.data ?? [];
  const gateLoading = loading || !user;
  // Only treat this as "loading" while we have nothing to show. Background
  // refetches keep the existing rows mounted so a tap in flight never lands
  // on a node that gets swapped out mid-gesture.
  const fetching =
    gateLoading ||
    ((clubsQuery.isLoading || universitiesQuery.isLoading) && clubs.length === 0);
  const error = gateLoading ? null : (clubsQuery.error ?? universitiesQuery.error);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clubs;
    return clubs.filter((c) => [c.club_name, c.universities?.name, c.description].filter(Boolean).join(" ").toLowerCase().includes(q));
  }, [clubs, query]);

  return (
    <HostAppShell>
      <LargeTitleHeader
        title="Clubs"
        subtitle="Your organizations and university chapters."
        trailing={
          <Button variant="hero" size="sm" className="rounded-full" onClick={() => setOpen(true)} disabled={gateLoading}>
            <Plus className="h-4 w-4" /> New
          </Button>
        }
      />

      <div className="mt-1">
        <IosSearchField value={query} onChange={setQuery} placeholder="Search clubs" />
      </div>

      <div className="mt-5">
        {fetching ? (
          <>
            <SectionLabel>Loading…</SectionLabel>
            <div className="space-y-3" aria-hidden>
              {[0, 1, 2].map((i) => (
                <div key={i} className="ios-card flex items-center gap-4 rounded-2xl p-4">
                  <div className="h-12 w-12 shrink-0 animate-pulse rounded-2xl bg-muted" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="h-4 w-2/5 animate-pulse rounded-full bg-muted" />
                    <div className="h-3 w-3/5 animate-pulse rounded-full bg-muted" />
                    <div className="h-3 w-1/3 animate-pulse rounded-full bg-muted" />
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : error ? (
          <div className="ios-card rounded-3xl p-6 text-center text-sm text-muted-foreground">{getManagementErrorMessage(error, "Unable to load clubs.")}</div>
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
        onOpenChange={(next) => {
          setOpen(next);
          // Closing the sheet without creating anything ends the guided run —
          // nothing here is required.
          if (!next && guided && !createdRef.current) {
            clearFirstRun(user?.id);
            setGuided(false);
          }
        }}
        universities={universities}
        title="Create Club"
        description={guided ? "Step 1 of 2 — create your group, then your first event." : "Add a new club to your workspace."}
        onSubmit={async (values) => {
          try {
            const created = await createClub.mutateAsync(values as never);
            setQuery("");
            createdRef.current = true;
            toast.success("Club created", { description: created.club_name });
            if (guided) {
              navigate({ to: "/events/new", search: { clubId: created.id, templateId: "", duplicateFrom: "" } });
              return;
            }
            navigate({ to: "/clubs/$clubId", params: { clubId: created.id } });
          } catch (error) {
            throw new Error(getManagementErrorMessage(error, "Unable to create club."));
          }
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
