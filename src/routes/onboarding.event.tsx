import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { DateInput, FormCard, InlineErrorMessage, OnboardingShell, PageHeadingBlock, PrimaryButton, ProgressIndicator, SecondaryTextLink, TextInput, TimeInput } from "@/components/attendance-hq/host-onboarding";
import { useAttendanceAuth } from "@/components/attendance-hq/auth-provider";
import { buildEventDefaults, combineDateAndTime, shiftTimeString } from "@/lib/attendance-hq";
import { createFirstEvent, ensureClientHostProfile, getClientOnboardingState } from "@/lib/host-onboarding-client";

const formSchema = z.object({
  eventName: z.string().trim().min(2, "Enter an event name").max(160, "Event name is too long"),
  eventDate: z.string().min(1, "Choose a date"),
  startTime: z.string().min(1, "Choose a start time"),
  endTime: z.string().min(1, "Choose an end time"),
  location: z.string().trim().max(160, "Location is too long").optional().or(z.literal("")),
  checkInOpensAt: z.string().min(1, "Choose when check-in opens"),
  checkInClosesAt: z.string().min(1, "Choose when check-in closes"),
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
    ],
  }),
  component: OnboardingEventRoute,
});

function OnboardingEventRoute() {
  const navigate = useNavigate();
  const { user, loading } = useAttendanceAuth();
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
    },
  });

  const eventDate = form.watch("eventDate");
  const startTime = form.watch("startTime");

  useEffect(() => {
    if (!eventDate || !startTime) return;
    form.setValue("checkInOpensAt", combineDateAndTime(eventDate, `${shiftTimeString(startTime, -15)}:00`), { shouldValidate: true });
    form.setValue("checkInClosesAt", combineDateAndTime(eventDate, `${shiftTimeString(startTime, 20)}:00`), { shouldValidate: true });
  }, [eventDate, form, startTime]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/sign-in" });
      return;
    }

    void ensureClientHostProfile(user)
      .then(() => getClientOnboardingState(user.id))
      .then((state) => {
        if (!state.club) {
          navigate({ to: "/onboarding/club" });
          return;
        }
        if (state.isComplete && state.event) {
          navigate({ to: "/events/$eventId", params: { eventId: state.event.id } });
          return;
        }
        setClubId(state.club.id);
      })
      .catch((error) => setSubmitError(error instanceof Error ? error.message : "Unable to load onboarding state."));
  }, [loading, navigate, user]);

  const onSubmit = form.handleSubmit(async (values) => {
    if (!clubId) return;
    setSubmitError(null);
    try {
      const event = await createFirstEvent({ clubId, ...values });
      navigate({ to: "/events/$eventId", params: { eventId: event.id }, search: { created: "1" } });
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Unable to create event.");
    }
  });

  if (loading || !user) return null;

  return (
    <OnboardingShell>
      <FormCard>
        <ProgressIndicator step={2} total={2} label="Create your first event" />
        <PageHeadingBlock title="Create your first event" description="Set up your first meeting or event so members can scan a QR code to check in." />
        <form className="space-y-4" onSubmit={(event) => void onSubmit(event)}>
          <TextInput label="Event name" error={form.formState.errors.eventName?.message} {...form.register("eventName")} />
          <DateInput label="Event date" error={form.formState.errors.eventDate?.message} {...form.register("eventDate")} />
          <TimeInput label="Start time" error={form.formState.errors.startTime?.message} {...form.register("startTime")} />
          <TimeInput label="End time" error={form.formState.errors.endTime?.message} {...form.register("endTime")} />
          <TextInput label="Location" error={form.formState.errors.location?.message} {...form.register("location")} />
          <DateTimeDisplay label="Check-in opens at" value={form.watch("checkInOpensAt")} />
          <DateTimeDisplay label="Check-in closes at" value={form.watch("checkInClosesAt")} />
          <InlineErrorMessage message={submitError ?? undefined} />
          <PrimaryButton type="submit" disabled={form.formState.isSubmitting || !clubId}>Create Event</PrimaryButton>
        </form>
        <div className="flex items-center justify-between gap-4 text-sm">
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
