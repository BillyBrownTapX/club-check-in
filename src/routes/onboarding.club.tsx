import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { FormCard, InlineErrorMessage, OnboardingShell, PageHeadingBlock, PrimaryButton, ProgressIndicator, SecondaryTextLink, TextAreaField, TextInput } from "@/components/attendance-hq/host-onboarding";
import { useAttendanceAuth } from "@/components/attendance-hq/auth-provider";
import { clubSchema } from "@/lib/attendance-hq-schemas";
import { createFirstClub, ensureClientHostProfile, getClientOnboardingState } from "@/lib/host-onboarding-client";

const formSchema = clubSchema;
type FormValues = z.infer<typeof formSchema>;

export const Route = createFileRoute("/onboarding/club")({
  head: () => ({
    meta: [
      { title: "Create your first club — Attendance HQ" },
      { name: "description", content: "Create your club to start setting up QR attendance events." },
    ],
  }),
  component: OnboardingClubRoute,
});

function OnboardingClubRoute() {
  const navigate = useNavigate();
  const { user, loading } = useAttendanceAuth();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { clubName: "", description: "" },
  });

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/sign-in" });
      return;
    }

    void ensureClientHostProfile(user)
      .then(() => getClientOnboardingState(user.id))
      .then((state) => {
        if (state.club && !state.event) {
          navigate({ to: "/onboarding/event" });
          return;
        }
        if (state.isComplete && state.event) {
          navigate({ to: "/events/$eventId", params: { eventId: state.event.id } });
        }
      })
      .catch(() => undefined);
  }, [loading, navigate, user]);

  const onSubmit = form.handleSubmit(async (values) => {
    if (!user) return;
    setSubmitError(null);
    try {
      await createFirstClub(user.id, values);
      navigate({ to: "/onboarding/event" });
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Unable to create club.");
    }
  });

  if (loading || !user) return null;

  return (
    <OnboardingShell>
      <FormCard>
        <ProgressIndicator step={1} total={2} label="Create your club" />
        <PageHeadingBlock title="Create your first club" description="This is the club or organization you’ll use to host events and track attendance." />
        <form className="space-y-4" onSubmit={(event) => void onSubmit(event)}>
          <TextInput label="Club name" autoComplete="organization" error={form.formState.errors.clubName?.message} {...form.register("clubName")} />
          <TextAreaField label="Description" placeholder="Optional" error={form.formState.errors.description?.message} {...form.register("description")} />
          <InlineErrorMessage message={submitError ?? undefined} />
          <PrimaryButton type="submit" disabled={form.formState.isSubmitting}>Continue</PrimaryButton>
        </form>
        <div className="flex items-center justify-between gap-4 text-sm">
          <p className="text-muted-foreground">You can edit these details later.</p>
          <SecondaryTextLink to="/sign-in">Back</SecondaryTextLink>
        </div>
      </FormCard>
    </OnboardingShell>
  );
}
