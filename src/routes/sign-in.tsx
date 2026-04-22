import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { AuthCard, AuthShell, AuthSupportLinks, EmailInput, InlineErrorMessage, PageHeadingBlock, PasswordInput, PrimaryButton, SecondaryTextLink, SuccessBanner } from "@/components/attendance-hq/host-onboarding";
import { useRequireGuestRedirect } from "@/components/attendance-hq/host-management";
import { supabase } from "@/integrations/supabase/client";
import { signInSchema } from "@/lib/attendance-hq-schemas";
import { normalizeSupabaseAuthError } from "@/lib/server-errors";

const formSchema = signInSchema;
type FormValues = z.infer<typeof formSchema>;

export const Route = createFileRoute("/sign-in")({
  validateSearch: (search: Record<string, unknown>): { reason?: string } => ({
    reason: typeof search.reason === "string" ? search.reason : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Sign in — Attendance HQ" },
      { name: "description", content: "Sign in to Attendance HQ and continue setting up or managing your event." },
      { property: "og:title", content: "Sign in — Attendance HQ" },
      { property: "og:description", content: "Sign in to Attendance HQ and continue setting up or managing your event." },
      { name: "twitter:title", content: "Sign in — Attendance HQ" },
      { name: "twitter:description", content: "Sign in to Attendance HQ and continue setting up or managing your event." },
    ],
  }),
  component: SignInRoute,
});

function SignInRoute() {
  const { loading: guardLoading } = useRequireGuestRedirect();
  const { reason } = Route.useSearch();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [authSettling, setAuthSettling] = useState(false);
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: "", password: "" },
  });

  const reasonMessage = reason === "expired" ? "Your session expired. Please sign in again to continue." : null;

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitError(null);
    setAuthSettling(false);
    const { data, error } = await supabase.auth.signInWithPassword({ email: values.email, password: values.password });
    if (error || !data.user) {
      setAuthSettling(false);
      setSubmitError(normalizeSupabaseAuthError(error, "Unable to sign in."));
      return;
    }
    setAuthSettling(true);
  });

  return (
    <AuthShell>
      <AuthCard>
        <PageHeadingBlock eyebrow="Welcome back" title="Sign in" description="Return to your UNG-branded event workspace and keep mobile attendance moving without delay." />
        {reasonMessage ? <SuccessBanner message={reasonMessage} /> : null}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-[1.35rem] surface-soft px-4 py-4"><p className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-primary/70">Workspace</p><p className="mt-1 font-display text-lg font-bold text-foreground">Host ops</p></div>
          <div className="rounded-[1.35rem] surface-cream px-4 py-4"><p className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-primary/70">Built for</p><p className="mt-1 font-display text-lg font-bold text-foreground">Phone-first teams</p></div>
        </div>
        <form className="space-y-4" onSubmit={(event) => void onSubmit(event)}>
          <EmailInput label="Email" disabled={guardLoading} error={form.formState.errors.email?.message} {...form.register("email")} />
          <PasswordInput label="Password" disabled={guardLoading} error={form.formState.errors.password?.message} {...form.register("password")} />
          <InlineErrorMessage message={submitError ?? undefined} />
          <PrimaryButton type="submit" disabled={guardLoading || form.formState.isSubmitting || authSettling}>{guardLoading ? "Loading..." : authSettling ? "Signing you in..." : "Sign in"}</PrimaryButton>
        </form>
        <AuthSupportLinks primary={<SecondaryTextLink from="/" to="/forgot-password">Forgot password</SecondaryTextLink>} secondary={<SecondaryTextLink from="/" to="/sign-up">Create account</SecondaryTextLink>} />
      </AuthCard>
    </AuthShell>
  );
}
