import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { AuthCard, AuthShell, AuthSupportLinks, EmailInput, InlineErrorMessage, PageHeadingBlock, PasswordInput, PrimaryButton, SecondaryTextLink, TextInput } from "@/components/attendance-hq/host-onboarding";
import { useAttendanceAuth } from "@/components/attendance-hq/auth-provider";
import { supabase } from "@/integrations/supabase/client";
import { signUpSchema } from "@/lib/attendance-hq-schemas";
import { ensureClientHostProfile, getClientOnboardingState } from "@/lib/host-onboarding-client";

const formSchema = signUpSchema;
type FormValues = z.infer<typeof formSchema>;

export const Route = createFileRoute("/sign-up")({
  head: () => ({
    meta: [
      { title: "Create account — Attendance HQ" },
      { name: "description", content: "Create your Attendance HQ account and set up your first club in minutes." },
    ],
  }),
  component: SignUpRoute,
});

function SignUpRoute() {
  const navigate = useNavigate();
  const { user, loading } = useAttendanceAuth();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { fullName: "", email: "", password: "" },
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
    const { data, error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: { data: { full_name: values.fullName } },
    });

    if (error) {
      setSubmitError(error.message);
      return;
    }

    if (!data.user) {
      setSubmitError("Unable to create account.");
      return;
    }

    await ensureClientHostProfile(data.user, values.fullName);
    navigate({ to: "/onboarding/club" });
  });

  return (
    <AuthShell>
      <AuthCard>
        <PageHeadingBlock title="Create your account" description="Set up your club and start tracking attendance in minutes." />
        <form className="space-y-4" onSubmit={(event) => void onSubmit(event)}>
          <TextInput label="Full name" autoComplete="name" error={form.formState.errors.fullName?.message} {...form.register("fullName")} />
          <EmailInput label="Email" error={form.formState.errors.email?.message} {...form.register("email")} />
          <PasswordInput label="Password" autoComplete="new-password" error={form.formState.errors.password?.message} {...form.register("password")} />
          <InlineErrorMessage message={submitError ?? undefined} />
          <PrimaryButton type="submit" disabled={form.formState.isSubmitting}>Create account</PrimaryButton>
        </form>
        <AuthSupportLinks primary={<SecondaryTextLink to="/sign-in">Already have an account? Sign in</SecondaryTextLink>} secondary={<p className="text-xs text-muted-foreground">By continuing you can immediately set up your first club and event.</p>} />
      </AuthCard>
    </AuthShell>
  );
}
