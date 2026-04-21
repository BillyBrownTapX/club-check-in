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
  const { loading: guardLoading } = useRequireGuestRedirect();
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
    if (!data.session) {
      setConfirmEmailNotice("Check your inbox to confirm your email, then sign in to continue setting up your club.");
      setAuthSettling(false);
      form.reset();
      return;
    }
    setAuthSettling(true);
  });

  return (
    <AuthShell>
      <AuthCard>
        <PageHeadingBlock eyebrow="Get started" title="Create your account" description="Launch a cleaner university-linked attendance system in just a few guided steps." />
        {confirmEmailNotice ? <SuccessBanner message={confirmEmailNotice} /> : null}
        <div className="rounded-[1.5rem] surface-soft px-4 py-4">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-primary/70">What happens next</p>
          <p className="mt-2 text-sm leading-6 text-foreground">Create your account, connect your club to its university, then launch the first QR-ready event from the same mobile workflow.</p>
        </div>
        <form className="space-y-4" onSubmit={(event) => void onSubmit(event)}>
          <TextInput label="Full name" autoComplete="name" disabled={guardLoading} error={form.formState.errors.fullName?.message} {...form.register("fullName")} />
          <EmailInput label="Email" disabled={guardLoading} error={form.formState.errors.email?.message} {...form.register("email")} />
          <PasswordInput label="Password" autoComplete="new-password" disabled={guardLoading} error={form.formState.errors.password?.message} {...form.register("password")} />
          <InlineErrorMessage message={submitError ?? undefined} />
          <PrimaryButton type="submit" disabled={guardLoading || form.formState.isSubmitting || authSettling}>{guardLoading ? "Loading..." : authSettling ? "Finishing setup..." : "Create account"}</PrimaryButton>
        </form>
        <AuthSupportLinks primary={<SecondaryTextLink from="/" to="/sign-in">Already have an account? Sign in</SecondaryTextLink>} secondary={<p className="text-xs text-muted-foreground">By continuing you can immediately set up your first club and event.</p>} />
      </AuthCard>
    </AuthShell>
  );
}
