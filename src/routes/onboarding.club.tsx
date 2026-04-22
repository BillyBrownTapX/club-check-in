import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { FormCard, InlineErrorMessage, OnboardingShell, PageHeadingBlock, PrimaryButton, ProgressIndicator, SecondaryTextLink, TextAreaField, TextInput } from "@/components/attendance-hq/host-onboarding";
import { useAuthorizedServerFn } from "@/components/attendance-hq/auth-provider";
import { ClubLogoField, getManagementErrorMessage, useRequireHostRedirect } from "@/components/attendance-hq/host-management";
import { clubSchema } from "@/lib/attendance-hq-schemas";
import { createClubManagement, getHostOnboardingState, getUniversitiesForHost } from "@/lib/attendance-hq.functions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const formSchema = clubSchema;
type FormValues = z.infer<typeof formSchema>;

export const Route = createFileRoute("/onboarding/club")({
  head: () => ({
    meta: [
      { title: "Create your first club — Attendance HQ" },
      { name: "description", content: "Create your club to start setting up QR attendance events." },
      { property: "og:title", content: "Create your first club — Attendance HQ" },
      { property: "og:description", content: "Create your club to start setting up QR attendance events." },
      { name: "twitter:title", content: "Create your first club — Attendance HQ" },
      { name: "twitter:description", content: "Create your club to start setting up QR attendance events." },
      { name: "robots", content: "noindex, nofollow" },
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
  const getUniversities = useAuthorizedServerFn(getUniversitiesForHost);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [stateLoaded, setStateLoaded] = useState(false);
  const [universities, setUniversities] = useState<Array<{ id: string; name: string }>>([]);
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { universityId: "", clubName: "", description: "", logoPath: null },
  });

  useEffect(() => {
    if (loading || !user) return;
    let cancelled = false;
    void Promise.all([fetchOnboardingState({ data: {} }), getUniversities()])
      .then(([{ onboarding }, universityRows]) => {
        if (cancelled) return;
        setUniversities(universityRows.map((row) => ({ id: row.id, name: row.name })));
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
      await createClub({ data: { universityId: values.universityId, clubName: values.clubName, description: values.description, logoPath: values.logoPath ?? null } });
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
        <PageHeadingBlock eyebrow="Setup" title="Create your first club" description="Add the club or organization you’ll manage most often so your workspace feels ready from day one." />
        <form className="space-y-4" onSubmit={(event) => void onSubmit(event)}>
          <ClubLogoField
            value={form.watch("logoPath") ?? null}
            onChange={(path) => form.setValue("logoPath", path, { shouldDirty: true })}
          />
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground">University</label>
            <Select value={form.watch("universityId")} onValueChange={(value) => form.setValue("universityId", value, { shouldValidate: true })}>
              <SelectTrigger className="h-12 rounded-2xl border-border/80 bg-background/90"><SelectValue placeholder="Choose a university" /></SelectTrigger>
              <SelectContent>{universities.map((university) => <SelectItem key={university.id} value={university.id}>{university.name}</SelectItem>)}</SelectContent>
            </Select>
            {form.formState.errors.universityId?.message ? <p className="text-sm text-destructive">{form.formState.errors.universityId.message}</p> : null}
          </div>
          <TextInput label="Club name" autoComplete="organization" error={form.formState.errors.clubName?.message} {...form.register("clubName")} />
          <TextAreaField label="Description" placeholder="Optional" error={form.formState.errors.description?.message} {...form.register("description")} />
          <InlineErrorMessage message={submitError ?? undefined} />
          <PrimaryButton type="submit" disabled={form.formState.isSubmitting}>Continue</PrimaryButton>
        </form>
        <div className="flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-muted-foreground">You can edit these details later.</p>
          <SecondaryTextLink to="/sign-in">Back</SecondaryTextLink>
        </div>
      </FormCard>
    </OnboardingShell>
  );
}
