import { createFileRoute } from "@tanstack/react-router";
import { AuthCard, AuthShell, AuthSupportLinks, PageHeadingBlock, SecondaryTextLink } from "@/components/attendance-hq/host-onboarding";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Use — Attendance HQ" },
      { name: "description", content: "Terms of use for Attendance HQ host accounts and event check-in." },
      { property: "og:title", content: "Terms of Use — Attendance HQ" },
      { property: "og:description", content: "Terms of use for Attendance HQ host accounts and event check-in." },
      { property: "og:type", content: "website" },
      { name: "twitter:title", content: "Terms of Use — Attendance HQ" },
      { name: "twitter:description", content: "Terms of use for Attendance HQ host accounts and event check-in." },
    ],
    links: [{ rel: "canonical", href: "https://checkin-swiftly.lovable.app/terms" }],
  }),
  component: TermsRoute,
});

function TermsRoute() {
  return (
    <AuthShell>
      <AuthCard>
        <PageHeadingBlock
          eyebrow="Terms"
          title="Terms of Use"
          description="The short version of what you can expect from Attendance HQ and what we expect back."
        />
        <div className="space-y-4 text-sm leading-6 text-foreground">
          <section className="space-y-1.5">
            <h2 className="font-display text-[15px] font-bold">Using Attendance HQ</h2>
            <p className="text-muted-foreground">
              Attendance HQ is provided to help campus clubs run event check-in. You are responsible
              for using it lawfully, honestly, and with respect for the students who check in at
              your events.
            </p>
          </section>
          <section className="space-y-1.5">
            <h2 className="font-display text-[15px] font-bold">Host responsibilities</h2>
            <p className="text-muted-foreground">
              Only invite officers you trust to help run your club. Keep your account credentials
              private. Use collected attendance data solely for legitimate club purposes, and share
              it only with people who have a real reason to see it.
            </p>
          </section>
          <section className="space-y-1.5">
            <h2 className="font-display text-[15px] font-bold">Data & availability</h2>
            <p className="text-muted-foreground">
              We work to keep Attendance HQ available, but the service is provided as-is without
              warranty. Back up any attendance rosters you need to keep long-term by exporting them
              from the event page.
            </p>
          </section>
          <section className="space-y-1.5">
            <h2 className="font-display text-[15px] font-bold">Changes</h2>
            <p className="text-muted-foreground">
              We may update these terms as the product evolves. Continuing to use Attendance HQ
              after a change means you accept the update.
            </p>
          </section>
        </div>
        <AuthSupportLinks
          primary={<SecondaryTextLink to="/">Back to home</SecondaryTextLink>}
          secondary={<SecondaryTextLink to="/privacy">View Privacy</SecondaryTextLink>}
        />
      </AuthCard>
    </AuthShell>
  );
}
