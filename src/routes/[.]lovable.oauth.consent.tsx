import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { CalendarPlus, ListChecks, ShieldCheck, Users } from "lucide-react";
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

const PERMISSIONS = [
  { icon: Users, title: "Your organizations", detail: "Clubs and departments you host or help run." },
  { icon: ListChecks, title: "Your events", detail: "Meetings, check-in windows, and status." },
  { icon: ShieldCheck, title: "Head counts and rosters", detail: "Live attendance totals and who checked in." },
  { icon: CalendarPlus, title: "Create events", detail: "Schedule new meetings on your organizations." },
];

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
    <main className="mx-auto flex min-h-screen max-w-md items-center px-5 py-10">
      <div className="w-full overflow-hidden rounded-[2rem] border border-border/60 bg-card shadow-xl">
        <div className="bg-gradient-brand px-7 pb-6 pt-7 text-primary-foreground">
          <p className="font-display text-[20px] font-extrabold tracking-tight">Attendance HQ</p>
          <p className="mt-1 text-[12.5px] font-medium opacity-85">Campus event check-in in seconds</p>
        </div>
        <div className="h-1 w-full bg-[hsl(var(--accent))]" />
        <div className="p-7">
          <h1 className="font-display text-[22px] font-extrabold leading-tight text-foreground">
            Connect {clientName} to your account
          </h1>
          <p className="mt-2 text-[14px] leading-6 text-muted-foreground">
            {clientName} will act as you, with exactly the access you already have. Nothing is shared
            until you approve.
          </p>

          <ul className="mt-5 space-y-3">
            {PERMISSIONS.map((perm) => {
              const Icon = perm.icon;
              return (
                <li key={perm.title} className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="h-[17px] w-[17px]" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[14.5px] font-semibold text-foreground">{perm.title}</p>
                    <p className="text-[12.5px] leading-5 text-muted-foreground">{perm.detail}</p>
                  </div>
                </li>
              );
            })}
          </ul>

          {error ? (
            <p role="alert" className="mt-5 rounded-2xl bg-destructive/10 p-3 text-[13px] text-destructive">
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
              {busy ? "Working…" : `Approve ${clientName}`}
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

          <p className="mt-5 text-center text-[12px] leading-5 text-muted-foreground">
            You can revoke this access at any time from your Attendance HQ account.
          </p>
        </div>
      </div>
    </main>
  );
}
