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
      { property: "og:title", content: "Reset your password — Attendance HQ" },
      { property: "og:description", content: "Send a password reset link for your Attendance HQ host account." },
      { name: "twitter:title", content: "Reset your password — Attendance HQ" },
      { name: "twitter:description", content: "Send a password reset link for your Attendance HQ host account." },
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
    try {
      await supabase.auth.resetPasswordForEmail(values.email, { redirectTo: `${window.location.origin}/reset-password` });
    } catch {
    }
    setSuccess(true);
  });

  return (
    <AuthShell>
      <AuthCard>
        <PageHeadingBlock eyebrow="Account recovery" title="Reset your password" description="We’ll send a secure reset link so you can get back into your workspace quickly." />
        {success ? <SuccessBanner message="If that email matches an account, we’ve sent a reset link. Check your inbox to continue." /> : null}
        <div className="rounded-[1.5rem] surface-cream px-4 py-4">
          <p className="text-sm leading-6 text-foreground">Use the email tied to your host workspace and continue the reset on the same phone for the smoothest handoff.</p>
        </div>
        <form className="space-y-4" onSubmit={(event) => void onSubmit(event)}>
          <EmailInput label="Email" error={form.formState.errors.email?.message} {...form.register("email")} />
          <PrimaryButton type="submit" disabled={form.formState.isSubmitting}>Send reset link</PrimaryButton>
        </form>
        <AuthSupportLinks primary={<SecondaryTextLink to="/sign-in">Back to sign in</SecondaryTextLink>} />
      </AuthCard>
    </AuthShell>
  );
}
