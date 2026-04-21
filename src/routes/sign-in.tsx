import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { AuthCard, AuthShell, AuthSupportLinks, EmailInput, InlineErrorMessage, PageHeadingBlock, PasswordInput, PrimaryButton, SecondaryTextLink } from "@/components/attendance-hq/host-onboarding";
import { useAttendanceAuth } from "@/components/attendance-hq/auth-provider";
import { supabase } from "@/integrations/supabase/client";
import { signInSchema } from "@/lib/attendance-hq-schemas";
import { ensureClientHostProfile, getClientOnboardingState } from "@/lib/host-onboarding-client";

const formSchema = signInSchema;
type FormValues = z.infer<typeof formSchema>;

export const Route = createFileRoute("/sign-in")({
  head: () => ({
    meta: [
      { title: "Sign in — Attendance HQ" },
      { name: "description", content: "Sign in to Attendance HQ and continue setting up or managing your event." },
    ],
  }),
  component: SignInRoute,
});

function SignInRoute() {
  const navigate = useNavigate();
  const { user, loading } = useAttendanceAuth();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: "", password: "" },
  });

  useEffect(() => {
    if (!loading && user) {
      void getClientOnboardingState(user.id).then((state) => {
        if (state.isComplete && state.event) {
          navigate({ to: "/events/$eventId", params: { eventId: state.event.id } });
          return;
        }
        window.location.href = state.nextPath;
      }).catch(() => undefined);
    }
  }, [loading, navigate, user]);

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitError(null);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    });

    if (error || !data.user) {
      setSubmitError(error?.message || "Unable to sign in.");
      return;
    }

    await ensureClientHostProfile(data.user);
    const state = await getClientOnboardingState(data.user.id);
    if (state.isComplete && state.event) {
      navigate({ to: "/events/$eventId", params: { eventId: state.event.id } });
      return;
    }
    window.location.href = state.nextPath;
  });

  return (
    <AuthShell>
      <AuthCard>
        <PageHeadingBlock title="Sign in" description="Pick up where you left off and keep attendance moving." />
        <form className="space-y-4" onSubmit={(event) => void onSubmit(event)}>
          <EmailInput label="Email" error={form.formState.errors.email?.message} {...form.register("email")} />
          <PasswordInput label="Password" error={form.formState.errors.password?.message} {...form.register("password")} />
          <InlineErrorMessage message={submitError ?? undefined} />
          <PrimaryButton type="submit" disabled={form.formState.isSubmitting}>Sign In</PrimaryButton>
        </form>
        <AuthSupportLinks
          primary={<SecondaryTextLink to="/forgot-password">Forgot password</SecondaryTextLink>}
          secondary={<SecondaryTextLink to="/sign-up">Create account</SecondaryTextLink>}
        />
      </AuthCard>
    </AuthShell>
  );
}
