import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { FormCard, InlineErrorMessage, OnboardingShell, PageHeadingBlock, PrimaryButton, ProgressIndicator, SecondaryTextLink, TextAreaField, TextInput } from "@/components/attendance-hq/host-onboarding";
import { useAuthorizedServerFn } from "@/components/attendance-hq/auth-provider";
import { getManagementErrorMessage, useRequireHostRedirect } from "@/components/attendance-hq/host-management";
import { clubSchema } from "@/lib/attendance-hq-schemas";
import { createClubManagement, getHostOnboardingState } from "@/lib/attendance-hq.functions";

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
  // Same guard the management routes use — if there is no session we are
  // bounced to /sign-in. No more inline useEffect redirect.
  const { loading, user } = useRequireHostRedirect();
  const navigate = useNavigate();
  const fetchOnboardingState = useAuthorizedServerFn(getHostOnboardingState);
  const createClub = useAuthorizedServerFn(createClubManagement);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [stateLoaded, setStateLoaded] = useState(false);
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { clubName: "", description: "" },
  });

  useEffect(() => {
    if (loading || !user) return;
    let cancelled = false;
    void fetchOnboardingState({ data: {} })
      .then(({ onboarding }) => {
        if (cancelled) return;
        // Server-authoritative deep-link guard: if onboarding has already
        // progressed past this step, jump forward instead of letting the
        // user create a duplicate first club.
        if (onboarding.club && !onboarding.event) {
          navigate({ to: "/onboarding/event" });
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
        setStateLoaded(true);
      })
      .catch((error) => {
        if (cancelled) return;
        setSubmitError(getManagementErrorMessage(error, "Unable to load onboarding state."));
        setStateLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchOnboardingState, loading, navigate, user]);

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      await createClub({ data: { clubName: values.clubName, description: values.description } });
      navigate({ to: "/onboarding/event" });
    } catch (error) {
      setSubmitError(getManagementErrorMessage(error, "Unable to create club."));
    }
  });

  if (loading || !user || !stateLoaded) return null;

  return (
    <OnboardingShell>
      <FormCard>
        <ProgressIndicator step={1} total={2} label="Create your club" />
        <PageHeadingBlock title="Create your first club" description="This is the club or organization you'll use to host events and track attendance." />
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
