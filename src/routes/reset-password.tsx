import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { AuthCard, AuthShell, AuthSupportLinks, InlineErrorMessage, PageHeadingBlock, PasswordInput, PrimaryButton, SecondaryTextLink, SuccessBanner } from "@/components/attendance-hq/host-onboarding";
import { useAttendanceAuth } from "@/components/attendance-hq/auth-provider";
import { supabase } from "@/integrations/supabase/client";
import { resetPasswordSchema } from "@/lib/attendance-hq-schemas";
import { getClientOnboardingState } from "@/lib/host-onboarding-client";

const formSchema = resetPasswordSchema;
type FormValues = z.infer<typeof formSchema>;

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Choose a new password — Attendance HQ" },
      { name: "description", content: "Set a new password for your Attendance HQ account." },
    ],
  }),
  component: ResetPasswordRoute,
});

function ResetPasswordRoute() {
  const navigate = useNavigate();
  const { user } = useAttendanceAuth();
  const [success, setSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  useEffect(() => {
    const hash = window.location.hash;
    if (!hash.includes("type=recovery") && !user) {
      setSubmitError("Open this page from your reset email to choose a new password.");
    }
  }, [user]);

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitError(null);
    const { error } = await supabase.auth.updateUser({ password: values.password });
    if (error) {
      setSubmitError(error.message);
      return;
    }
    setSuccess(true);
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      const state = await getClientOnboardingState(data.user.id);
      window.setTimeout(() => {
        if (state.isComplete && state.event) {
          navigate({ to: "/events/$eventId", params: { eventId: state.event.id } });
          return;
        }
        window.location.href = state.nextPath;
      }, 600);
    }
  });

  return (
    <AuthShell>
      <AuthCard>
        <PageHeadingBlock title="Choose a new password" description="Set a new password and continue into your host workspace." />
        {success ? <SuccessBanner message="Password updated. Redirecting you back into Attendance HQ." /> : null}
        <form className="space-y-4" onSubmit={(event) => void onSubmit(event)}>
          <PasswordInput label="New password" autoComplete="new-password" error={form.formState.errors.password?.message} {...form.register("password")} />
          <PasswordInput label="Confirm password" autoComplete="new-password" error={form.formState.errors.confirmPassword?.message} {...form.register("confirmPassword")} />
          <InlineErrorMessage message={submitError ?? undefined} />
          <PrimaryButton type="submit" disabled={form.formState.isSubmitting}>Save password</PrimaryButton>
        </form>
        <AuthSupportLinks primary={<SecondaryTextLink to="/sign-in">Back to sign in</SecondaryTextLink>} />
      </AuthCard>
    </AuthShell>
  );
}
