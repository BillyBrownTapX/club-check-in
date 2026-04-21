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
  // `?reason=expired` is set by useAuthorizedServerFn whenever a server fn
  // 401s while a host is mid-session, so the sign-in screen can show a
  // friendly "your session expired" banner instead of dumping the user
  // back to a blank login form with no explanation. Marking `reason` as
  // optional in the return type is important — without the `?`, every
  // existing `<Link to="/sign-in">` and `navigate({ to: "/sign-in" })`
  // in the codebase would be a type error for "missing required search".
  validateSearch: (search: Record<string, unknown>): { reason?: string } => ({
    reason: typeof search.reason === "string" ? search.reason : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Sign in — Attendance HQ" },
      { name: "description", content: "Sign in to Attendance HQ and continue setting up or managing your event." },
    ],
  }),
  component: SignInRoute,
});

function SignInRoute() {
  // Already-authenticated visitors get bounced to wherever the server says
  // they belong (events, onboarding/club, onboarding/event). Same logic
  // sign-up and reset-password use, so behaviour is identical across all
  // auth landings.
  useRequireGuestRedirect();
  const { reason } = Route.useSearch();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [authSettling, setAuthSettling] = useState(false);
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: "", password: "" },
  });

  // Map the redirect reason to a friendly explanation. Anything we don't
  // recognize is intentionally ignored — we don't want a malicious link
  // like ?reason=<script> rendering arbitrary text.
  const reasonMessage =
    reason === "expired"
      ? "Your session expired. Please sign in again to continue."
      : null;

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitError(null);
    setAuthSettling(false);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    });

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
        <PageHeadingBlock title="Sign in" description="Pick up where you left off and keep attendance moving." />
        {reasonMessage ? <SuccessBanner message={reasonMessage} /> : null}
        <form className="space-y-4" onSubmit={(event) => void onSubmit(event)}>
          <EmailInput label="Email" error={form.formState.errors.email?.message} {...form.register("email")} />
          <PasswordInput label="Password" error={form.formState.errors.password?.message} {...form.register("password")} />
          <InlineErrorMessage message={submitError ?? undefined} />
          <PrimaryButton type="submit" disabled={form.formState.isSubmitting || authSettling}>{authSettling ? "Signing you in..." : "Sign In"}</PrimaryButton>
        </form>
        <AuthSupportLinks
          primary={<SecondaryTextLink to="/forgot-password">Forgot password</SecondaryTextLink>}
          secondary={<SecondaryTextLink to="/sign-up">Create account</SecondaryTextLink>}
        />
      </AuthCard>
    </AuthShell>
  );
}
