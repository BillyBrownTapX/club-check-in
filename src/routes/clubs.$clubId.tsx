import { useMemo, useState } from "react";
import { Link, createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { ArrowRightLeft, CalendarDays, History, Pencil, Plus, Trash2, UserPlus, Users, WandSparkles, X } from "lucide-react";
import { useAuthorizedMutation, useAuthorizedQuery } from "@/components/attendance-hq/auth-provider";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ActionSheet,
  ActionSheetItem,
  ClubDialog,
  EmptyStateBlock,
  EventCard,
  ManagementPageShell,
  TemplateCard,
  TemplateDialog,
  getManagementErrorMessage,
  useRequireHostRedirect,
} from "@/components/attendance-hq/host-management";
import {
  ActionTile,
  Chip,
  LargeTitleHeader,
  SectionLabel,
  StatTile,
} from "@/components/attendance-hq/ios";
import {
  addClubOfficer,
  createEventTemplate,
  deleteClub,
  deleteEvent,
  duplicateEventTemplate,
  getClubDetail,
  removeClubOfficer,
  updateClub,
  updateEventTemplate,
} from "@/lib/attendance-hq.functions";
import { useSignedLogoUrl } from "@/hooks/use-signed-logo";
import type { ClubMemberEntry, EventTemplateWithClub, ManagementEventSummary } from "@/lib/attendance-hq";
import { queryKeys } from "@/lib/query-keys";


function ClubDetailNotFound() {
  return (
    <ManagementPageShell>
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-foreground">Club not found</h2>
          <p className="text-sm text-muted-foreground">It may have been deleted, or you don't have access.</p>
        </div>
        <Button asChild variant="hero">
          <Link to="/clubs">Back to clubs</Link>
        </Button>
      </div>
    </ManagementPageShell>
  );
}

function ClubDetailError({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  return (
    <ManagementPageShell>
      <div className="ios-card mx-auto mt-12 max-w-md rounded-3xl p-6 text-center">
        <p className="text-sm text-destructive">{getManagementErrorMessage(error, "Unable to load club.")}</p>
        <Button className="mt-4" variant="hero" onClick={() => { router.invalidate(); reset(); }}>Try again</Button>
      </div>
    </ManagementPageShell>
  );
}

export const Route = createFileRoute("/clubs/$clubId")({
  errorComponent: ClubDetailError,
  notFoundComponent: ClubDetailNotFound,
  head: () => ({
    meta: [
      { title: "Club management — Attendance HQ" },
      { name: "description", content: "Manage one club, its events, and reusable event templates." },
      { property: "og:title", content: "Club management — Attendance HQ" },
      { property: "og:description", content: "Manage one club, its events, and reusable event templates." },
      { name: "twitter:title", content: "Club management — Attendance HQ" },
      { name: "twitter:description", content: "Manage one club, its events, and reusable event templates." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ClubDetailRoute,
});

function ClubDetailRoute() {
  const { loading, user } = useRequireHostRedirect();
  const { clubId } = Route.useParams();
  const navigate = useNavigate();
  const [clubDialogOpen, setClubDialogOpen] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EventTemplateWithClub | null>(null);

  const clubDetailQuery = useAuthorizedQuery(
    queryKeys.clubs.detail(clubId),
    getClubDetail,
    { clubId },
    { staleTime: 15_000 },
  );

  // Mutations — invalidate by prefix so list + detail + events all stay in sync.
  const updateClubMutation = useAuthorizedMutation(updateClub, {
    invalidate: [queryKeys.clubs.all, queryKeys.events.all],
  });
  const deleteClubMutation = useAuthorizedMutation(deleteClub, {
    invalidate: [queryKeys.clubs.all, queryKeys.events.all],
  });
  const deleteEventMutation = useAuthorizedMutation(deleteEvent, {
    invalidate: [queryKeys.clubs.all, queryKeys.events.all],
  });
  const createTemplateMutation = useAuthorizedMutation(createEventTemplate, {
    invalidate: [queryKeys.clubs.detail(clubId)],
  });
  const updateTemplateMutation = useAuthorizedMutation(updateEventTemplate, {
    invalidate: [queryKeys.clubs.detail(clubId)],
  });
  const duplicateTemplateMutation = useAuthorizedMutation(duplicateEventTemplate, {
    invalidate: [queryKeys.clubs.detail(clubId)],
  });
  const addOfficerMutation = useAuthorizedMutation(addClubOfficer, {
    invalidate: [queryKeys.clubs.detail(clubId)],
  });
  const removeOfficerMutation = useAuthorizedMutation(removeClubOfficer, {
    invalidate: [queryKeys.clubs.detail(clubId)],
  });

  const [officerDialogOpen, setOfficerDialogOpen] = useState(false);
  const [officerEmail, setOfficerEmail] = useState("");

  const data = clubDetailQuery.data ?? null;
  const fetching = clubDetailQuery.isLoading;
  const error = clubDetailQuery.error;

  const handleDeleteClub = async () => {
    await deleteClubMutation.mutateAsync({ clubId } as never);
    toast.success("Club deleted");
    navigate({ to: "/clubs" });
  };

  const handleDeleteEvent = async (eventId: string) => {
    await deleteEventMutation.mutateAsync({ eventId } as never);
    toast.success("Event deleted");
  };

  if (loading || !user) return <ManagementPageShell><div className="py-16 text-center text-sm text-muted-foreground">Loading club…</div></ManagementPageShell>;
  if (fetching && !data) return <ManagementPageShell><div className="py-16 text-center text-sm text-muted-foreground">Loading club…</div></ManagementPageShell>;
  if (error && !data) {
    // Defensive: if the query throws but TanStack didn't already forward to
    // the boundary (rare with notFound() — but possible for raw errors),
    // surface it inline.
    return <ClubDetailError error={error} reset={() => clubDetailQuery.refetch()} />;
  }
  if (!data) return <ClubDetailNotFound />;

  const universityLabel = data.club.universities?.name ?? "University needed";
  const isOwner = data.viewerRole === "owner";

  const handleAddOfficer = async () => {
    const email = officerEmail.trim();
    if (!email) return;
    try {
      await addOfficerMutation.mutateAsync({ clubId, email } as never);
      toast.success("Officer added");
      setOfficerEmail("");
      setOfficerDialogOpen(false);
    } catch (e) {
      toast.error(getManagementErrorMessage(e, "Unable to add officer."));
    }
  };

  const handleRemoveOfficer = async (membership: ClubMemberEntry) => {
    try {
      await removeOfficerMutation.mutateAsync({ clubId, membershipId: membership.id } as never);
      toast.success("Officer removed");
    } catch (e) {
      toast.error(getManagementErrorMessage(e, "Unable to remove officer."));
    }
  };


  return (
    <ManagementPageShell>
      <div className="space-y-5 pb-20 md:pb-0">
        <LargeTitleHeader
          eyebrow={universityLabel}
          title={data.club.club_name}
          trailing={
            <Button
              type="button"
              variant="tonal"
              size="icon"
              className="rounded-full"
              aria-label="Edit club"
              onClick={() => setClubDialogOpen(true)}
            >
              <Pencil className="h-[18px] w-[18px]" />
            </Button>
          }
        />

        {/* Hero card */}
        <div className="ios-card rounded-[1.75rem] p-5">
          <div className="flex items-start gap-4">
            <ClubHeaderLogo path={data.club.logo_url ?? null} name={data.club.club_name} />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-[17px] font-extrabold text-foreground truncate">{data.club.club_name}</h2>
                <Chip tone={data.club.is_active ? "success" : "muted"}>
                  {data.club.is_active ? "Active" : "Inactive"}
                </Chip>
              </div>
              <p className="text-[13px] leading-snug text-muted-foreground">
                {data.club.description || "Add a short description to help your team identify this club."}
              </p>
            </div>
          </div>
        </div>

        {/* Stats — horizontal scroll */}
        <div className="-mx-4 overflow-x-auto px-4 sm:-mx-5 sm:px-5">
          <div className="flex gap-3 pb-1">
            <StatTile label="Upcoming" value={data.stats.upcomingEvents} icon={CalendarDays} hint="Scheduled" />
            <StatTile label="Past" value={data.stats.pastEvents} icon={History} hint="Completed" />
            <StatTile label="Check-ins" value={data.stats.totalCheckIns} icon={Users} tone="blue" hint="All-time" />
          </div>
        </div>

        {/* 2×2 ActionTile grid */}
        <div className="grid grid-cols-2 gap-3">
          <ActionTile
            icon={Plus}
            label="Create Event"
            hint="Schedule a new event"
            tone="gold"
            to="/events/new"
            search={{ clubId: data.club.id, templateId: "", duplicateFrom: "" }}
          />
          <ActionTile
            icon={WandSparkles}
            label="New Template"
            hint="Save a reusable setup"
            onClick={() => { setEditingTemplate(null); setTemplateDialogOpen(true); }}
          />
          <ActionTile
            icon={Pencil}
            label="Edit Club"
            hint="Update club details"
            onClick={() => setClubDialogOpen(true)}
          />
          {isOwner ? (
            <ActionSheet
              trigger={
                <button
                  type="button"
                  className="ios-press flex h-full flex-col items-start justify-between gap-3 rounded-2xl bg-destructive/8 p-4 text-left"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/15 text-destructive">
                    <Trash2 className="h-5 w-5" />
                  </span>
                  <span>
                    <span className="block font-display text-[15px] font-bold leading-tight text-destructive">Delete Club</span>
                    <span className="mt-1 block text-[12px] text-muted-foreground">Remove permanently</span>
                  </span>
                </button>
              }
              title="Delete this club?"
              description="Deletes the club permanently. Clubs with events or check-in history can't be deleted — archive their events first."
            >
              <ActionSheetItem icon={Trash2} label="Delete club permanently" destructive onClick={handleDeleteClub} />
            </ActionSheet>
          ) : null}

        </div>

        {/* Upcoming events */}
        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <SectionLabel className="mb-0 px-0">Upcoming events</SectionLabel>
            <Link
              to="/events"
              search={{ clubId: data.club.id, status: "upcoming", query: "" }}
              className="text-[13px] font-semibold text-primary"
            >
              View all
            </Link>
          </div>
          {data.upcomingEvents.length ? (
            <div className="flex flex-col gap-3">
              {data.upcomingEvents.map((event: ManagementEventSummary) => (
                <EventCard
                  key={event.id}
                  event={event}
                  showClub={false}
                  onDuplicate={(eventId) => navigate({ to: "/events/new", search: { clubId: data.club.id, templateId: "", duplicateFrom: eventId } })}
                  onDelete={handleDeleteEvent}
                />
              ))}
            </div>
          ) : (
            <EmptyStateBlock
              title="No upcoming events"
              description="Create your next event to start tracking attendance."
            />
          )}
        </section>

        {/* Past events */}
        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <SectionLabel className="mb-0 px-0">Past events</SectionLabel>
            <Link
              to="/events"
              search={{ clubId: data.club.id, status: "past", query: "" }}
              className="text-[13px] font-semibold text-primary"
            >
              View all
            </Link>
          </div>
          {data.pastEvents.length ? (
            <div className="flex flex-col gap-3">
              {data.pastEvents.map((event: ManagementEventSummary) => (
                <EventCard
                  key={event.id}
                  event={event}
                  showClub={false}
                  onDuplicate={(eventId) => navigate({ to: "/events/new", search: { clubId: data.club.id, templateId: "", duplicateFrom: eventId } })}
                  onDelete={handleDeleteEvent}
                />
              ))}
            </div>
          ) : (
            <EmptyStateBlock
              title="No past events"
              description="Past events will show here once your club starts hosting them."
            />
          )}
        </section>

        {/* Templates */}
        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <SectionLabel className="mb-0 px-0">Templates</SectionLabel>
            <button
              type="button"
              onClick={() => { setEditingTemplate(null); setTemplateDialogOpen(true); }}
              className="inline-flex items-center gap-1 text-[13px] font-semibold text-primary"
              aria-label="Create template"
            >
              <Plus className="h-4 w-4" />
              New
            </button>
          </div>
          {data.templates.length ? (
            <div className="flex flex-col gap-3">
              {data.templates.map((template: EventTemplateWithClub) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  onUse={(templateId) => navigate({ to: "/events/new", search: { clubId: data.club.id, templateId, duplicateFrom: "" } })}
                  onEdit={(template) => { setEditingTemplate(template); setTemplateDialogOpen(true); }}
                  onDuplicate={async (templateId) => {
                    await duplicateTemplateMutation.mutateAsync({ templateId } as never);
                  }}
                />
              ))}
            </div>
          ) : (
            <EmptyStateBlock
              title="No templates yet"
              description="Create a template to speed up recurring event setup."
            />
          )}
        </section>

        {/* Officers */}
        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <SectionLabel className="mb-0 px-0">Officers</SectionLabel>
            {isOwner ? (
              <button
                type="button"
                onClick={() => { setOfficerEmail(""); setOfficerDialogOpen(true); }}
                className="inline-flex items-center gap-1 text-[13px] font-semibold text-primary"
                aria-label="Add officer"
              >
                <UserPlus className="h-4 w-4" />
                Add
              </button>
            ) : null}
          </div>
          <div className="ios-card divide-y divide-border/60 rounded-2xl">
            {data.members.map((member) => (
              <div key={member.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-display text-[15px] font-semibold text-foreground">
                      {member.fullName || member.email || "Unknown"}
                    </span>
                    <Chip tone={member.role === "owner" ? "success" : "muted"}>
                      {member.role === "owner" ? "Owner" : "Officer"}
                    </Chip>
                  </div>
                  {member.email ? (
                    <div className="truncate text-[12px] text-muted-foreground">{member.email}</div>
                  ) : null}
                </div>
                {isOwner && member.role === "officer" ? (
                  <ActionSheet
                    trigger={
                      <button
                        type="button"
                        aria-label={`Remove ${member.fullName || member.email}`}
                        className="ios-press inline-flex h-9 w-9 items-center justify-center rounded-full bg-destructive/10 text-destructive"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    }
                    title="Remove officer?"
                    description="They will lose access to this club."
                  >
                    <ActionSheetItem icon={Trash2} label="Remove officer" destructive onClick={() => handleRemoveOfficer(member)} />
                  </ActionSheet>
                ) : null}
              </div>
            ))}
            {!data.members.length ? (
              <div className="px-4 py-6 text-center text-[13px] text-muted-foreground">No members yet.</div>
            ) : null}
          </div>
          {isOwner ? (
            <p className="px-1 text-[12px] text-muted-foreground">
              Officers must already have an Attendance HQ account.
            </p>
          ) : null}
        </section>

        <ClubDialog
          open={clubDialogOpen}
          onOpenChange={setClubDialogOpen}
          title="Edit Club"
          description="Keep this club’s details current."
          universities={data.universities}
          initialValues={{ clubId: data.club.id, universityId: data.club.university_id ?? "", clubName: data.club.club_name, description: data.club.description ?? "", isActive: data.club.is_active, logoPath: data.club.logo_url ?? null }}
          onSubmit={async (values) => {
            const saved = await updateClubMutation.mutateAsync(values as never);
            toast.success("Club saved", { description: saved.club_name });
          }}
          onDelete={isOwner ? handleDeleteClub : undefined}
        />

        <Dialog open={officerDialogOpen} onOpenChange={setOfficerDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add officer</DialogTitle>
              <DialogDescription>
                Enter the email of an existing Attendance HQ host to give them officer access.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="officer-email">Email</Label>
              <Input
                id="officer-email"
                type="email"
                autoComplete="off"
                placeholder="officer@ung.edu"
                value={officerEmail}
                onChange={(e) => setOfficerEmail(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void handleAddOfficer(); } }}
              />
              <p className="text-[12px] text-muted-foreground">
                They must already have an Attendance HQ account.
              </p>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOfficerDialogOpen(false)}>Cancel</Button>
              <Button
                type="button"
                variant="hero"
                onClick={handleAddOfficer}
                disabled={addOfficerMutation.isPending || !officerEmail.trim()}
              >
                {addOfficerMutation.isPending ? "Adding…" : "Add officer"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>


        <TemplateDialog
          open={templateDialogOpen}
          onOpenChange={(open) => {
            setTemplateDialogOpen(open);
            if (!open) setEditingTemplate(null);
          }}
          clubId={data.club.id}
          initialValues={editingTemplate ? {
            templateId: editingTemplate.id,
            templateName: editingTemplate.template_name,
            defaultEventName: editingTemplate.default_event_name ?? "",
            defaultLocation: editingTemplate.default_location ?? "",
            defaultStartTime: editingTemplate.default_start_time ?? "",
            defaultEndTime: editingTemplate.default_end_time ?? "",
            defaultCheckInOpenOffsetMinutes: editingTemplate.default_check_in_open_offset_minutes,
            defaultCheckInCloseOffsetMinutes: editingTemplate.default_check_in_close_offset_minutes,
          } : undefined}
          onSubmit={async (values) => {
            if (editingTemplate) {
              const saved = await updateTemplateMutation.mutateAsync(values as never);
              toast.success("Template saved", { description: saved.template_name });
            } else {
              const created = await createTemplateMutation.mutateAsync(values as never);
              toast.success("Template created", { description: created.template_name });
            }
          }}
        />
      </div>
    </ManagementPageShell>
  );
}

function ClubHeaderLogo({ path, name }: { path: string | null; name: string }) {
  const url = useSignedLogoUrl(path);
  const initials = name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "C";
  return (
    <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-brand font-display text-base font-extrabold text-primary-foreground shadow-[0_14px_30px_-20px_color-mix(in_oklab,var(--color-primary)_40%,transparent)]">
      {url ? <img src={url} alt={`${name} logo`} className="h-full w-full object-cover" /> : <span>{initials}</span>}
    </div>
  );
}
