import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { AuthCard, AuthShell, AuthSupportLinks, EmailInput, PageHeadingBlock, PrimaryButton, SecondaryTextLink, SuccessBanner } from "@/components/attendance-hq/host-onboarding";
import { supabase } from "@/integrations/supabase/client";
import { forgotPasswordSchema } from "@/lib/attendance-hq-schemas";

const formSchema = forgotPasswordSchema;
type FormValues = z.infer<typeof formSchema>;

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Reset your password — Attendance HQ" },
      { name: "description", content: "Send a password reset link for your Attendance HQ host account." },
    ],
  }),
  component: ForgotPasswordRoute,
});

function ForgotPasswordRoute() {
  const [success, setSuccess] = useState(false);
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setSuccess(false);
    // Always show the same neutral confirmation regardless of whether the
    // address matches a real account. Surfacing Supabase's specific error
    // messages here would let an attacker enumerate which emails belong to
    // real hosts. We still log to the network so genuine infra failures
    // (rate limiting, network errors) are visible in DevTools.
    try {
      await supabase.auth.resetPasswordForEmail(values.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
    } catch {
      // swallow — see comment above
    }
    setSuccess(true);
  });

  return (
    <AuthShell>
      <AuthCard>
        <PageHeadingBlock title="Reset your password" description="We’ll send a reset link so you can get back into your account." />
        {success ? <SuccessBanner message="If that email matches an account, we’ve sent a reset link. Check your inbox to continue." /> : null}
        <form className="space-y-4" onSubmit={(event) => void onSubmit(event)}>
          <EmailInput label="Email" error={form.formState.errors.email?.message} {...form.register("email")} />
          <PrimaryButton type="submit" disabled={form.formState.isSubmitting}>Send reset link</PrimaryButton>
        </form>
        <AuthSupportLinks primary={<SecondaryTextLink to="/sign-in">Back to sign in</SecondaryTextLink>} />
      </AuthCard>
    </AuthShell>
  );
}
