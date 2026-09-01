import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Bot, CalendarPlus, Check, ClipboardCopy, ListChecks, Mail, ShieldCheck, Users } from "lucide-react";
import { toast } from "sonner";
import { useAuthorizedMutation } from "@/components/attendance-hq/auth-provider";
import { HostAppShell } from "@/components/attendance-hq/host-shell";
import { useRequireHostRedirect } from "@/components/attendance-hq/host-management";
import { GroupedList, LargeTitleHeader, SectionLabel } from "@/components/attendance-hq/ios";
import { Button } from "@/components/ui/button";
import { PRODUCTION_APP_ORIGIN } from "@/lib/attendance-hq";
import { emailAgentSetupLink } from "@/lib/agent-integration.functions";

const MCP_URL = `${PRODUCTION_APP_ORIGIN}/mcp`;

const CAPABILITIES = [
  { icon: Users, title: "List your organizations", detail: "Every club or department you host or help run." },
  { icon: ListChecks, title: "Find events", detail: "Upcoming, live, and past meetings with their check-in windows." },
  { icon: ShieldCheck, title: "Head counts and rosters", detail: "Live attendance totals and who checked in." },
  { icon: CalendarPlus, title: "Schedule an event", detail: "Create a new meeting on one of your organizations." },
];

const CLIENTS = [
  {
    name: "ChatGPT",
    steps: ["Settings → Connectors → Add custom connector", "Paste the server URL", "Sign in and approve"],
  },
  {
    name: "Claude",
    steps: ["Settings → Connectors → Add custom connector", "Paste the server URL", "Sign in and approve"],
  },
  {
    name: "MANUS",
    steps: ["Open MANUS → Add MCP server", "Paste the server URL", "Sign in and approve"],
  },
];

export const Route = createFileRoute("/agents")({
  head: () => ({
    meta: [
      { title: "Connect an AI assistant — Attendance HQ" },
      {
        name: "description",
        content:
          "Connect ChatGPT, Claude, Cursor, or Lovable to Attendance HQ so your assistant can pull head counts, rosters, and schedule events as you.",
      },
      { property: "og:title", content: "Connect an AI assistant — Attendance HQ" },
      {
        property: "og:description",
        content: "Set up agent access to your clubs, events, and attendance rosters.",
      },
      { name: "twitter:title", content: "Connect an AI assistant — Attendance HQ" },
      {
        name: "twitter:description",
        content: "Set up agent access to your clubs, events, and attendance rosters.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AgentsRoute,
});

function AgentsRoute() {
  const { loading, user } = useRequireHostRedirect();
  const [copied, setCopied] = useState(false);
  const emailMutation = useAuthorizedMutation(emailAgentSetupLink);

  if (loading || !user) {
    return (
      <HostAppShell>
        <div className="py-16 text-center text-sm text-muted-foreground">Loading…</div>
      </HostAppShell>
    );
  }

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(MCP_URL);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy — select the address and copy it manually.");
    }
  };

  const emailMe = async () => {
    try {
      const result = (await emailMutation.mutateAsync(undefined as never)) as
        | { sent: true; email: string }
        | { sent: false; email: string; reason: "suppressed" };
      if (result.sent) toast.success(`Setup link sent to ${result.email}`);
      else toast.error("We couldn't email that address. Try a different one in your account settings.");
    } catch {
      toast.error("Unable to send the setup link right now.");
    }
  };

  return (
    <HostAppShell>
      <LargeTitleHeader
        eyebrow="Agent integrations"
        title="Connect an AI assistant"
        subtitle="Ask ChatGPT, Claude, Cursor, or Lovable about your events — it works as you, with your access."
      />

      <SectionLabel className="mt-6">Server address</SectionLabel>
      <div className="ios-card rounded-2xl p-4">
        <p className="break-all font-mono text-[13px] leading-6 text-foreground">{MCP_URL}</p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <Button variant="tonal" className="flex-1 rounded-2xl" onClick={copyUrl}>
            {copied ? <Check className="mr-2 h-4 w-4" /> : <ClipboardCopy className="mr-2 h-4 w-4" />}
            {copied ? "Copied" : "Copy address"}
          </Button>
          <Button
            className="flex-1 rounded-2xl"
            onClick={emailMe}
            disabled={emailMutation.isPending}
          >
            <Mail className="mr-2 h-4 w-4" />
            {emailMutation.isPending ? "Sending…" : "Email me this link"}
          </Button>
        </div>
      </div>

      <SectionLabel className="mt-6">What your assistant can do</SectionLabel>
      <GroupedList>
        {CAPABILITIES.map((cap) => {
          const Icon = cap.icon;
          return (
            <div key={cap.title} className="flex items-start gap-3 px-4 py-3.5">
              <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon className="h-[17px] w-[17px]" />
              </span>
              <div className="min-w-0">
                <p className="text-[15px] font-semibold text-foreground">{cap.title}</p>
                <p className="text-[13px] leading-5 text-muted-foreground">{cap.detail}</p>
              </div>
            </div>
          );
        })}
      </GroupedList>

      <SectionLabel className="mt-6">Add it to your assistant</SectionLabel>
      <div className="grid gap-3 sm:grid-cols-2">
        {CLIENTS.map((client) => (
          <div key={client.name} className="ios-card rounded-2xl p-4">
            <p className="font-display text-[15px] font-extrabold text-foreground">{client.name}</p>
            <ol className="mt-2 space-y-1.5">
              {client.steps.map((step, i) => (
                <li key={step} className="flex gap-2 text-[13px] leading-5 text-muted-foreground">
                  <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-secondary text-[11px] font-bold text-primary">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>

      <div className="ios-card mt-4 flex items-start gap-3 rounded-2xl p-4">
        <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Bot className="h-[17px] w-[17px]" />
        </span>
        <p className="text-[13px] leading-5 text-muted-foreground">
          The first time an assistant connects, Attendance HQ shows you an approval screen listing
          exactly what it can access. Nothing is shared until you approve, and you can revoke access
          at any time.
        </p>
      </div>
    </HostAppShell>
  );
}
