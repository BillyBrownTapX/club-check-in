import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { AuthCard, AuthShell, AuthSupportLinks, InlineErrorMessage, PageHeadingBlock, PasswordInput, PrimaryButton, SecondaryTextLink, SuccessBanner } from "@/components/attendance-hq/host-onboarding";
import { useAttendanceAuth } from "@/components/attendance-hq/auth-provider";
import { getManagementErrorMessage, useResolvePostAuthRedirect } from "@/components/attendance-hq/host-management";
import { supabase } from "@/integrations/supabase/client";
import { resetPasswordSchema } from "@/lib/attendance-hq-schemas";
import { normalizeSupabaseAuthError } from "@/lib/server-errors";

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
  // We intentionally do NOT use useRequireGuestRedirect here. Reset-password
  // is reachable in two states: (a) coming back from a recovery email with
  // type=recovery in the hash and a temporary session, (b) already signed
  // in. Either way the user has work to do on this page (set a new
  // password); auto-redirecting them off would defeat the point.
  const { user } = useAttendanceAuth();
  const resolveRedirect = useResolvePostAuthRedirect();
  const [success, setSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  useEffect(() => {
    const hash = typeof window === "undefined" ? "" : window.location.hash;
    if (!hash.includes("type=recovery") && !user) {
      setSubmitError("Open this page from your reset email to choose a new password.");
    }
  }, [user]);

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitError(null);
    const { error } = await supabase.auth.updateUser({ password: values.password });
    if (error) {
      setSubmitError(normalizeSupabaseAuthError(error, "Unable to update password."));
      return;
    }
    setSuccess(true);
    // Brief pause so the success banner is actually visible before the
    // redirect helper navigates away.
    window.setTimeout(() => {
      void resolveRedirect().catch((resolveError) => {
        setSubmitError(getManagementErrorMessage(resolveError, "Password updated but we couldn't open your workspace."));
      });
    }, 600);
  });

  return (
    <AuthShell>
      <AuthCard>
        <PageHeadingBlock eyebrow="Secure your account" title="Choose a new password" description="Set a new password and continue straight back into your host workspace." />
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
