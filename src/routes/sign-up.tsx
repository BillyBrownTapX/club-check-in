import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { AuthCard, AuthShell, AuthSupportLinks, EmailInput, InlineErrorMessage, PageHeadingBlock, PasswordInput, PrimaryButton, SecondaryTextLink, SuccessBanner, TextInput } from "@/components/attendance-hq/host-onboarding";
import { useRequireGuestRedirect } from "@/components/attendance-hq/host-management";
import { supabase } from "@/integrations/supabase/client";
import { signUpSchema } from "@/lib/attendance-hq-schemas";
import { normalizeSupabaseAuthError } from "@/lib/server-errors";

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
  useRequireGuestRedirect();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmEmailNotice, setConfirmEmailNotice] = useState<string | null>(null);
  const [authSettling, setAuthSettling] = useState(false);
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { fullName: "", email: "", password: "" },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitError(null);
    setConfirmEmailNotice(null);
    setAuthSettling(false);
    const { data, error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: { data: { full_name: values.fullName } },
    });

    if (error) {
      setAuthSettling(false);
      setSubmitError(normalizeSupabaseAuthError(error, "Unable to create account."));
      return;
    }

    if (!data.user) {
      setAuthSettling(false);
      setSubmitError("Unable to create account.");
      return;
    }

    // When Supabase has email confirmation enabled the signUp call returns
    // a user but no session. There's nothing to redirect to yet — the
    // host_profile bootstrap happens server-side on first authenticated
    // call (see getHostOnboardingState).
    if (!data.session) {
      setConfirmEmailNotice(
        "Check your inbox to confirm your email, then sign in to continue setting up your club.",
      );
      setAuthSettling(false);
      form.reset();
      return;
    }

    setAuthSettling(true);
  });

  return (
    <AuthShell>
      <AuthCard>
        <PageHeadingBlock eyebrow="Get started" title="Create your account" description="Set up your club, launch your first QR check-in, and manage attendance with a polished mobile workflow." />
        {confirmEmailNotice ? <SuccessBanner message={confirmEmailNotice} /> : null}
        <form className="space-y-4" onSubmit={(event) => void onSubmit(event)}>
          <TextInput label="Full name" autoComplete="name" error={form.formState.errors.fullName?.message} {...form.register("fullName")} />
          <EmailInput label="Email" error={form.formState.errors.email?.message} {...form.register("email")} />
          <PasswordInput label="Password" autoComplete="new-password" error={form.formState.errors.password?.message} {...form.register("password")} />
          <InlineErrorMessage message={submitError ?? undefined} />
          <PrimaryButton type="submit" disabled={form.formState.isSubmitting || authSettling}>{authSettling ? "Finishing setup..." : "Create account"}</PrimaryButton>
        </form>
        <AuthSupportLinks primary={<SecondaryTextLink to="/sign-in">Already have an account? Sign in</SecondaryTextLink>} secondary={<p className="text-xs text-muted-foreground">By continuing you can immediately set up your first club and event.</p>} />
      </AuthCard>
    </AuthShell>
  );
}
