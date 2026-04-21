import { useEffect, useMemo, useState } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { CalendarDays, Copy, Plus } from "lucide-react";
import { useAuthorizedServerFn } from "@/components/attendance-hq/auth-provider";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ClubDialog, DeleteConfirmButton, EmptyStateBlock, ManagementPageShell, PageHeader, PrimaryButton, SecondaryButton, StatsCard, TemplateCard, TemplateDialog, EventCard, FormCard, getManagementErrorMessage, useRequireHostRedirect } from "@/components/attendance-hq/host-management";
import { createEventTemplate, deleteClub, deleteEvent, duplicateEventTemplate, getClubDetail, updateClub, updateEventTemplate } from "@/lib/attendance-hq.functions";
import { useSignedLogoUrl } from "@/hooks/use-signed-logo";
import type { EventTemplateWithClub, ManagementEventSummary } from "@/lib/attendance-hq";

function ClubDetailNotFound() {
  return <ManagementPageShell><div className="py-16 text-center text-sm text-muted-foreground">Club not found.</div></ManagementPageShell>;
}

function ClubDetailError({ error }: { error: Error }) {
  return <ManagementPageShell><div className="py-16 text-center text-sm text-muted-foreground">{error.message}</div></ManagementPageShell>;
}

export const Route = createFileRoute("/clubs/$clubId")({
  errorComponent: ClubDetailError,
  notFoundComponent: ClubDetailNotFound,
  head: () => ({
    meta: [
      { title: "Club management — Attendance HQ" },
      { name: "description", content: "Manage one club, its events, and reusable event templates." },
    ],
  }),
  component: ClubDetailRoute,
});

function ClubDetailRoute() {
  const { loading, user } = useRequireHostRedirect();
  const { clubId } = Route.useParams();
  const navigate = useNavigate();
  const getClub = useAuthorizedServerFn(getClubDetail);
  const updateClubMutation = useAuthorizedServerFn(updateClub);
  const createTemplateMutation = useAuthorizedServerFn(createEventTemplate);
  const updateTemplateMutation = useAuthorizedServerFn(updateEventTemplate);
  const duplicateTemplateMutation = useAuthorizedServerFn(duplicateEventTemplate);
  const [clubDialogOpen, setClubDialogOpen] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EventTemplateWithClub | null>(null);
  const [data, setData] = useState<Awaited<ReturnType<typeof getClubDetail>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (loading || !user) return;
    let cancelled = false;

    const load = async () => {
      setFetching(true);
      setError(null);
      try {
        const nextData = await getClub({ data: { clubId } });
        if (!cancelled) setData(nextData);
      } catch (loadError) {
        if (!cancelled) setError(getManagementErrorMessage(loadError, "Unable to load club."));
      } finally {
        if (!cancelled) setFetching(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [clubId, getClub, loading, user]);

  const title = useMemo(() => data?.club.club_name ?? "Club", [data?.club.club_name]);

  if (loading || !user) return <ManagementPageShell><div className="py-16 text-center text-sm text-muted-foreground">Loading club…</div></ManagementPageShell>;
  if (fetching) return <ManagementPageShell><div className="py-16 text-center text-sm text-muted-foreground">Loading club…</div></ManagementPageShell>;
  if (error) return <ClubDetailError error={new Error(error)} />;
  if (!data) return <ClubDetailNotFound />;

  return (
    <ManagementPageShell>
      <div className="space-y-5 pb-20 md:pb-0">
        <PageHeader
          title={title}
          description={data.club.description || "Manage upcoming events, past attendance, and recurring templates for this club."}
          action={<PrimaryButton asChild><Link to="/events/new" search={{ clubId: data.club.id, templateId: "", duplicateFrom: "" }}>Create Event</Link></PrimaryButton>}
        />

        <FormCard>
          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-4">
              <ClubHeaderLogo path={data.club.logo_url ?? null} name={data.club.club_name} />
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-semibold text-foreground">{data.club.club_name}</h2>
                  <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">{data.club.is_active ? "Active" : "Inactive"}</span>
                </div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{data.club.universities?.name ?? "University needed"}</p>
                <p className="text-sm text-muted-foreground">{data.club.description || "Add a short description to help your team identify this club."}</p>
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <PrimaryButton asChild><Link to="/events/new" search={{ clubId: data.club.id, templateId: "", duplicateFrom: "" }}>Create Event</Link></PrimaryButton>
              <SecondaryButton type="button" onClick={() => { setEditingTemplate(null); setTemplateDialogOpen(true); }}>Create Template</SecondaryButton>
              <SecondaryButton type="button" onClick={() => setClubDialogOpen(true)}>Edit Club</SecondaryButton>
            </div>
          </div>
        </FormCard>

        <div className="grid gap-4">
          <StatsCard label="Upcoming Events" value={data.stats.upcomingEvents} hint="What’s scheduled next" />
          <StatsCard label="Past Events" value={data.stats.pastEvents} hint="History for this club" />
          <StatsCard label="Total Check-Ins" value={data.stats.totalCheckIns} hint="Attendance captured so far" />
        </div>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-foreground">Upcoming events</h2>
            <SecondaryButton asChild><Link to="/events" search={{ clubId: data.club.id, status: "upcoming", query: "" }}>View All</Link></SecondaryButton>
          </div>
          {data.upcomingEvents.length ? (
              <div className="grid gap-4">
               {data.upcomingEvents.map((event: ManagementEventSummary) => <EventCard key={event.id} event={event} showClub={false} onDuplicate={(eventId) => navigate({ to: "/events/new", search: { clubId: data.club.id, templateId: "", duplicateFrom: eventId } })} />)}
            </div>
          ) : (
            <EmptyStateBlock title="No upcoming events" description="Create your next event to start tracking attendance." action={<PrimaryButton asChild><Link to="/events/new" search={{ clubId: data.club.id, templateId: "", duplicateFrom: "" }}>Create Event</Link></PrimaryButton>} />
          )}
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-foreground">Past events</h2>
            <SecondaryButton asChild><Link to="/events" search={{ clubId: data.club.id, status: "past", query: "" }}>View All</Link></SecondaryButton>
          </div>
          {data.pastEvents.length ? (
              <div className="grid gap-4">
               {data.pastEvents.map((event: ManagementEventSummary) => <EventCard key={event.id} event={event} showClub={false} onDuplicate={(eventId) => navigate({ to: "/events/new", search: { clubId: data.club.id, templateId: "", duplicateFrom: eventId } })} />)}
            </div>
          ) : (
            <EmptyStateBlock title="No past events" description="Past events will show here once your club starts hosting them." />
          )}
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-foreground">Event templates</h2>
            <SecondaryButton type="button" onClick={() => { setEditingTemplate(null); setTemplateDialogOpen(true); }}><Plus className="h-4 w-4" />Create Template</SecondaryButton>
          </div>
          {data.templates.length ? (
              <div className="grid gap-4 xl:grid-cols-3">
              {data.templates.map((template: EventTemplateWithClub) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  onUse={(templateId) => navigate({ to: "/events/new", search: { clubId: data.club.id, templateId, duplicateFrom: "" } })}
                  onEdit={(template) => { setEditingTemplate(template); setTemplateDialogOpen(true); }}
                  onDuplicate={async (templateId) => {
                     await duplicateTemplateMutation({ data: { templateId } });
                     setData(await getClub({ data: { clubId } }));
                  }}
                />
              ))}
            </div>
          ) : (
            <EmptyStateBlock title="No templates yet" description="Create a template to speed up recurring event setup." action={<PrimaryButton type="button" onClick={() => setTemplateDialogOpen(true)}>Create Template</PrimaryButton>} />
          )}
        </section>

        <ClubDialog
          open={clubDialogOpen}
          onOpenChange={setClubDialogOpen}
          title="Edit Club"
          description="Keep this club’s details current."
          universities={data.universities}
          initialValues={{ clubId: data.club.id, universityId: data.club.university_id ?? "", clubName: data.club.club_name, description: data.club.description ?? "", isActive: data.club.is_active, logoPath: data.club.logo_url ?? null }}
          onSubmit={async (values) => {
             await updateClubMutation({ data: values as never });
             setData(await getClub({ data: { clubId } }));
          }}
        />

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
             if (editingTemplate) await updateTemplateMutation({ data: values as never });
             else await createTemplateMutation({ data: values as never });
             setData(await getClub({ data: { clubId } }));
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
    <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-brand font-display text-lg font-extrabold text-primary-foreground shadow-[0_14px_30px_-20px_color-mix(in_oklab,var(--color-primary)_40%,transparent)]">
      {url ? <img src={url} alt={`${name} logo`} className="h-full w-full object-cover" /> : <span>{initials}</span>}
    </div>
  );
}
