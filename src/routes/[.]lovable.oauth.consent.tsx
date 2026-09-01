import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type OAuthDetails = {
  client?: { name?: string | null } | null;
  redirect_url?: string | null;
  redirect_to?: string | null;
};

type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<{ data: OAuthDetails | null; error: { message: string } | null }>;
  approveAuthorization: (id: string) => Promise<{ data: OAuthDetails | null; error: { message: string } | null }>;
  denyAuthorization: (id: string) => Promise<{ data: OAuthDetails | null; error: { message: string } | null }>;
};

function oauthApi(): OAuthApi {
  return (supabase.auth as unknown as { oauth: OAuthApi }).oauth;
}

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Missing authorization_id");
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      throw redirect({ to: "/sign-in", search: { next: location.pathname + location.searchStr } });
    }
  },
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await oauthApi().getAuthorizationDetails(authorizationId);
    if (error) throw new Error(error.message);
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    return data;
  },
  component: ConsentRoute,
  errorComponent: ({ error }) => (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-5">
      <div className="ios-card w-full rounded-[2rem] p-7 text-center">
        <h1 className="ios-screen-title">Authorization unavailable</h1>
        <p className="mt-2 text-[14px] leading-6 text-muted-foreground">
          {String((error as Error)?.message ?? error)}
        </p>
      </div>
    </main>
  ),
});

function ConsentRoute() {
  const details = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clientName = details?.client?.name ?? "this app";

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const api = oauthApi();
    const { data, error: apiError } = approve
      ? await api.approveAuthorization(authorization_id)
      : await api.denyAuthorization(authorization_id);
    if (apiError) {
      setBusy(false);
      setError(apiError.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("No redirect returned by the authorization server.");
      return;
    }
    window.location.href = target;
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-5">
      <div className="ios-card w-full rounded-[2rem] p-7">
        <h1 className="ios-screen-title">Connect {clientName} to Attendance HQ</h1>
        <p className="mt-2 text-[14px] leading-6 text-muted-foreground">
          {clientName} will be able to read your clubs, events, and attendance rosters and create events as you. You can
          revoke access at any time.
        </p>
        {error ? (
          <p role="alert" className="mt-4 rounded-2xl bg-destructive/10 p-3 text-[13px] text-destructive">
            {error}
          </p>
        ) : null}
        <div className="mt-6 flex flex-col gap-2.5">
          <button
            type="button"
            disabled={busy}
            onClick={() => decide(true)}
            className="inline-flex h-12 items-center justify-center rounded-2xl bg-gradient-brand px-5 font-display text-[16px] font-extrabold text-primary-foreground disabled:opacity-60"
          >
            Approve
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => decide(false)}
            className="inline-flex h-12 items-center justify-center rounded-2xl bg-secondary px-5 text-[16px] font-semibold text-foreground disabled:opacity-60"
          >
            Deny
          </button>
        </div>
      </div>
    </main>
  );
}
