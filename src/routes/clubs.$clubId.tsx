import { useMemo, useState } from "react";
import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { CalendarDays, Copy, Plus } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { ClubDialog, EmptyStateBlock, ManagementPageShell, PageHeader, PrimaryButton, SecondaryButton, StatsCard, TemplateCard, TemplateDialog, EventCard, FormCard, useRequireHostRedirect } from "@/components/attendance-hq/host-management";
import { createEventTemplate, duplicateEventTemplate, getClubDetail, updateClub, updateEventTemplate } from "@/lib/attendance-hq.functions";
import type { EventTemplateWithClub } from "@/lib/attendance-hq";

function ClubDetailNotFound() {
  return <ManagementPageShell><div className="py-16 text-center text-sm text-muted-foreground">Club not found.</div></ManagementPageShell>;
}

function ClubDetailError({ error }: { error: Error }) {
  return <ManagementPageShell><div className="py-16 text-center text-sm text-muted-foreground">{error.message}</div></ManagementPageShell>;
}

export const Route = createFileRoute("/clubs/$clubId")({
  loader: ({ params }) => getClubDetail({ data: { clubId: params.clubId } }),
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
  const data = Route.useLoaderData();
  const router = useRouter();
  const navigate = useNavigate();
  const updateClubMutation = useServerFn(updateClub);
  const createTemplateMutation = useServerFn(createEventTemplate);
  const updateTemplateMutation = useServerFn(updateEventTemplate);
  const duplicateTemplateMutation = useServerFn(duplicateEventTemplate);
  const [clubDialogOpen, setClubDialogOpen] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EventTemplateWithClub | null>(null);

  const title = useMemo(() => data.club.club_name, [data.club.club_name]);

  if (loading || !user) return null;

  return (
    <ManagementPageShell>
      <div className="space-y-6 pb-20 md:pb-0">
        <PageHeader
          title={title}
          description={data.club.description || "Manage upcoming events, past attendance, and recurring templates for this club."}
          action={<PrimaryButton asChild><a href={`/events/new?clubId=${data.club.id}`}>Create Event</a></PrimaryButton>}
        />

        <FormCard>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-semibold text-foreground">{data.club.club_name}</h2>
                <span className="inline-flex items-center rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-foreground">{data.club.is_active ? "Active" : "Inactive"}</span>
              </div>
              <p className="text-sm text-muted-foreground">{data.club.description || "Add a short description to help your team identify this club."}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <PrimaryButton asChild><a href={`/events/new?clubId=${data.club.id}`}>Create Event</a></PrimaryButton>
              <SecondaryButton type="button" onClick={() => { setEditingTemplate(null); setTemplateDialogOpen(true); }}>Create Template</SecondaryButton>
              <SecondaryButton type="button" onClick={() => setClubDialogOpen(true)}>Edit Club</SecondaryButton>
            </div>
          </div>
        </FormCard>

        <div className="grid gap-4 sm:grid-cols-3">
          <StatsCard label="Upcoming Events" value={data.stats.upcomingEvents} hint="What’s scheduled next" />
          <StatsCard label="Past Events" value={data.stats.pastEvents} hint="History for this club" />
          <StatsCard label="Total Check-Ins" value={data.stats.totalCheckIns} hint="Attendance captured so far" />
        </div>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-foreground">Upcoming events</h2>
            <SecondaryButton asChild><a href={`/events?clubId=${data.club.id}&status=upcoming`}>View All</a></SecondaryButton>
          </div>
          {data.upcomingEvents.length ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {data.upcomingEvents.map((event) => <EventCard key={event.id} event={event} showClub={false} onDuplicate={(eventId) => navigate({ to: "/events/new", search: { duplicateFrom: eventId } })} />)}
            </div>
          ) : (
            <EmptyStateBlock title="No upcoming events" description="Create your next event to start tracking attendance." action={<PrimaryButton asChild><a href={`/events/new?clubId=${data.club.id}`}>Create Event</a></PrimaryButton>} />
          )}
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-foreground">Past events</h2>
            <SecondaryButton asChild><a href={`/events?clubId=${data.club.id}&status=past`}>View All</a></SecondaryButton>
          </div>
          {data.pastEvents.length ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {data.pastEvents.map((event) => <EventCard key={event.id} event={event} showClub={false} onDuplicate={(eventId) => navigate({ to: "/events/new", search: { duplicateFrom: eventId } })} />)}
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
            <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
              {data.templates.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  onUse={(templateId) => navigate({ to: "/events/new", search: { templateId } })}
                  onEdit={(template) => { setEditingTemplate(template); setTemplateDialogOpen(true); }}
                  onDuplicate={async (templateId) => {
                    await duplicateTemplateMutation({ data: { templateId } });
                    await router.invalidate({ sync: true });
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
          initialValues={{ clubId: data.club.id, clubName: data.club.club_name, description: data.club.description ?? "", isActive: data.club.is_active }}
          onSubmit={async (values) => {
            await updateClubMutation({ data: values as never });
            await router.invalidate({ sync: true });
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
            await router.invalidate({ sync: true });
          }}
        />
      </div>
    </ManagementPageShell>
  );
}
