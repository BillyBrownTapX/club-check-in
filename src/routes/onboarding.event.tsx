import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { DateInput, FormCard, InlineErrorMessage, OnboardingShell, PageHeadingBlock, PrimaryButton, ProgressIndicator, SecondaryTextLink, TextInput, TimeInput } from "@/components/attendance-hq/host-onboarding";
import { useAuthorizedServerFn } from "@/components/attendance-hq/auth-provider";
import { getManagementErrorMessage, useRequireHostRedirect } from "@/components/attendance-hq/host-management";
import { buildEventDefaults, combineDateAndTime, shiftTimeString } from "@/lib/attendance-hq";
import { createEvent, getHostOnboardingState } from "@/lib/attendance-hq.functions";

const baseEventSchema = z.object({
  eventName: z.string().trim().min(2, "Enter an event name").max(160, "Event name is too long"),
  eventDate: z.string().min(1, "Choose a date"),
  startTime: z.string().min(1, "Choose a start time"),
  endTime: z.string().min(1, "Choose an end time"),
  location: z.string().trim().max(160, "Location is too long").optional().or(z.literal("")),
  checkInOpensAt: z.string().min(1, "Choose when check-in opens"),
  checkInClosesAt: z.string().min(1, "Choose when check-in closes"),
});

const formSchema = baseEventSchema.extend({
  openMinutesBeforeStart: z.coerce.number().int().min(0).max(1440),
  closeMinutesAfterEnd: z.coerce.number().int().min(0).max(1440),
}).refine((value) => value.endTime > value.startTime, {
  message: "End time must be after start time",
  path: ["endTime"],
}).refine((value) => new Date(value.checkInClosesAt).getTime() > new Date(value.checkInOpensAt).getTime(), {
  message: "Check-in close must be after open",
  path: ["checkInClosesAt"],
});
type FormValues = z.infer<typeof formSchema>;

export const Route = createFileRoute("/onboarding/event")({
  head: () => ({
    meta: [
      { title: "Create your first event — Attendance HQ" },
      { name: "description", content: "Create your first event and open the QR-ready attendance flow." },
      { property: "og:title", content: "Create your first event — Attendance HQ" },
      { property: "og:description", content: "Create your first event and open the QR-ready attendance flow." },
      { name: "twitter:title", content: "Create your first event — Attendance HQ" },
      { name: "twitter:description", content: "Create your first event and open the QR-ready attendance flow." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: OnboardingEventRoute,
});

function OnboardingEventRoute() {
  const { loading, user } = useRequireHostRedirect();
  const navigate = useNavigate();
  const fetchOnboardingState = useAuthorizedServerFn(getHostOnboardingState);
  const createEventMutation = useAuthorizedServerFn(createEvent);
  const defaults = useMemo(() => buildEventDefaults(new Date()), []);
  const [clubId, setClubId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      eventName: "",
      eventDate: defaults.eventDate,
      startTime: defaults.startTime,
      endTime: defaults.endTime,
      location: "",
      checkInOpensAt: defaults.checkInOpensAt,
      checkInClosesAt: defaults.checkInClosesAt,
      openMinutesBeforeStart: 15,
      closeMinutesAfterEnd: 15,
    },
  });

  const eventDate = form.watch("eventDate");
  const startTime = form.watch("startTime");
  const endTime = form.watch("endTime");
  const openMinutesBeforeStart = form.watch("openMinutesBeforeStart");
  const closeMinutesAfterEnd = form.watch("closeMinutesAfterEnd");
  const opensPreview = form.watch("checkInOpensAt");
  const closesPreview = form.watch("checkInClosesAt");

  useEffect(() => {
    if (!eventDate || !startTime || !endTime) return;
    form.setValue(
      "checkInOpensAt",
      combineDateAndTime(eventDate, `${shiftTimeString(startTime, -openMinutesBeforeStart)}:00`),
      { shouldValidate: true },
    );
    form.setValue(
      "checkInClosesAt",
      combineDateAndTime(eventDate, `${shiftTimeString(endTime, closeMinutesAfterEnd)}:00`),
      { shouldValidate: true },
    );
  }, [closeMinutesAfterEnd, endTime, eventDate, form, openMinutesBeforeStart, startTime]);

  useEffect(() => {
    if (loading || !user) return;
    let cancelled = false;
    void fetchOnboardingState({ data: {} })
      .then(({ onboarding }) => {
        if (cancelled) return;
        if (!onboarding.club) {
          navigate({ to: "/onboarding/club" });
          return;
        }
        if (onboarding.isComplete && onboarding.event) {
          navigate({
            to: "/events/$eventId",
            params: { eventId: onboarding.event.id },
            search: { created: "" },
          });
          return;
        }
        setClubId(onboarding.club.id);
      })
      .catch((error) => {
        if (cancelled) return;
        setSubmitError(getManagementErrorMessage(error, "Unable to load onboarding state."));
      });
    return () => {
      cancelled = true;
    };
  }, [fetchOnboardingState, loading, navigate, user]);

  const onSubmit = form.handleSubmit(async (values) => {
    if (!clubId) return;
    setSubmitError(null);
    try {
      const result = await createEventMutation({
        data: {
          clubId,
          eventTemplateId: "",
          eventName: values.eventName,
          eventDate: values.eventDate,
          startTime: values.startTime,
          endTime: values.endTime,
          location: values.location ?? "",
          checkInOpensAt: values.checkInOpensAt,
          checkInClosesAt: values.checkInClosesAt,
        },
      });
      navigate({ to: "/events/$eventId", params: { eventId: result.event.id }, search: { created: "1" } });
    } catch (error) {
      setSubmitError(getManagementErrorMessage(error, "Unable to create event."));
    }
  });

  if (loading || !user) return null;

  return (
    <OnboardingShell>
      <FormCard>
        <ProgressIndicator step={2} total={2} label="Create your first event" />
        <PageHeadingBlock eyebrow="Setup" title="Create your first event" description="Set up your first meeting so members can scan in quickly and you can manage attendance live from your phone." />
        <form className="space-y-4" onSubmit={(event) => void onSubmit(event)}>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-[1.4rem] border border-border/80 bg-surface/70 px-4 py-3"><p className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Date</p><p className="mt-1 text-sm font-semibold text-foreground">{eventDate || "Select"}</p></div>
            <div className="rounded-[1.4rem] border border-border/80 bg-surface/70 px-4 py-3"><p className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Start</p><p className="mt-1 text-sm font-semibold text-foreground">{startTime || "Select"}</p></div>
            <div className="rounded-[1.4rem] border border-border/80 bg-surface/70 px-4 py-3"><p className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">End</p><p className="mt-1 text-sm font-semibold text-foreground">{endTime || "Select"}</p></div>
          </div>
          <section className="space-y-4 rounded-[1.7rem] border border-border/80 bg-surface/70 p-4">
            <div className="space-y-1">
              <h2 className="text-base font-semibold text-foreground">Event basics</h2>
              <p className="text-sm leading-6 text-muted-foreground">Create a clean event record that is easy for hosts to recognize instantly.</p>
            </div>
            <TextInput label="Event name" error={form.formState.errors.eventName?.message} {...form.register("eventName")} />
            <DateInput label="Event date" error={form.formState.errors.eventDate?.message} {...form.register("eventDate")} />
            <TimeInput label="Start time" error={form.formState.errors.startTime?.message} {...form.register("startTime")} />
            <TimeInput label="End time" error={form.formState.errors.endTime?.message} {...form.register("endTime")} />
            <TextInput label="Location" error={form.formState.errors.location?.message} {...form.register("location")} />
          </section>
          <section className="space-y-4 rounded-[1.7rem] border border-border/80 bg-surface/70 p-4">
            <div className="space-y-1">
              <h2 className="text-base font-semibold text-foreground">Check-in timing</h2>
              <p className="text-sm leading-6 text-muted-foreground">Preview the exact attendance window before you launch the first QR flow.</p>
            </div>
            <div className="grid gap-4">
              <TextInput type="number" label="Open minutes before start" error={form.formState.errors.openMinutesBeforeStart?.message} {...form.register("openMinutesBeforeStart", { valueAsNumber: true })} />
              <TextInput type="number" label="Close minutes after end" error={form.formState.errors.closeMinutesAfterEnd?.message} {...form.register("closeMinutesAfterEnd", { valueAsNumber: true })} />
            </div>
            <div className="grid gap-3">
              <DateTimeDisplay label="Check-in opens at" value={opensPreview} />
              <DateTimeDisplay label="Check-in closes at" value={closesPreview} />
            </div>
          </section>
          <InlineErrorMessage message={submitError ?? undefined} />
          <div className="sticky bottom-[max(1rem,env(safe-area-inset-bottom))] z-10 -mx-2 rounded-[1.75rem] border border-border/90 bg-card/96 p-3 shadow-[0_24px_52px_-28px_color-mix(in_oklab,var(--color-primary)_42%,transparent)] backdrop-blur">
            <PrimaryButton type="submit" disabled={form.formState.isSubmitting || !clubId}>Create Event</PrimaryButton>
          </div>
        </form>
        <div className="flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-muted-foreground">You can edit this event later.</p>
          <SecondaryTextLink to="/onboarding/club">Back</SecondaryTextLink>
        </div>
      </FormCard>
    </OnboardingShell>
  );
}

function DateTimeDisplay({ label, value }: { label: string; value: string }) {
  const date = new Date(value);
  return (
    <div className="space-y-2 rounded-2xl bg-secondary px-4 py-3">
      <div className="text-sm font-semibold text-foreground">{label}</div>
      <div className="text-sm text-muted-foreground">{Number.isNaN(date.getTime()) ? "—" : date.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</div>
    </div>
  );
}
