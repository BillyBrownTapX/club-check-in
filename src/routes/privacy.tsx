import { createFileRoute } from "@tanstack/react-router";
import { AuthCard, AuthShell, AuthSupportLinks, PageHeadingBlock, SecondaryTextLink } from "@/components/attendance-hq/host-onboarding";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Attendance HQ" },
      { name: "description", content: "How Attendance HQ handles host account and student check-in data." },
      { property: "og:title", content: "Privacy Policy — Attendance HQ" },
      { property: "og:description", content: "How Attendance HQ handles host account and student check-in data." },
      { property: "og:type", content: "website" },
      { name: "twitter:title", content: "Privacy Policy — Attendance HQ" },
      { name: "twitter:description", content: "How Attendance HQ handles host account and student check-in data." },
    ],
    links: [{ rel: "canonical", href: "https://checkin-swiftly.lovable.app/privacy" }],
  }),
  component: PrivacyRoute,
});

function PrivacyRoute() {
  return (
    <AuthShell>
      <AuthCard>
        <PageHeadingBlock
          eyebrow="Privacy"
          title="Privacy Policy"
          description="A short, honest summary of what data Attendance HQ collects and why."
        />
        <div className="space-y-4 text-sm leading-6 text-foreground">
          <section className="space-y-1.5">
            <h2 className="font-display text-[15px] font-bold">What we collect</h2>
            <p className="text-muted-foreground">
              Host accounts: name, email, and password (hashed) to sign in and manage your clubs.
              Student check-in: name, university email, and student ID (e.g. 900 number) submitted at
              the event to record attendance.
            </p>
          </section>
          <section className="space-y-1.5">
            <h2 className="font-display text-[15px] font-bold">Why we collect it</h2>
            <p className="text-muted-foreground">
              To run event check-in, produce accurate attendance rosters for the host club, and let
              returning students check in faster on the same device.
            </p>
          </section>
          <section className="space-y-1.5">
            <h2 className="font-display text-[15px] font-bold">Who can see it</h2>
            <p className="text-muted-foreground">
              Attendance data is visible to the hosts (owners and officers) of the club that ran the
              event. We do not sell, rent, or share attendance data with third parties for
              advertising.
            </p>
          </section>
          <section className="space-y-1.5">
            <h2 className="font-display text-[15px] font-bold">Contact</h2>
            <p className="text-muted-foreground">
              For access, correction, or deletion requests about your attendance record, contact the
              club that hosted the event you attended. Hosts can reach us through their campus club
              organization.
            </p>
          </section>
        </div>
        <AuthSupportLinks
          primary={<SecondaryTextLink to="/">Back to home</SecondaryTextLink>}
          secondary={<SecondaryTextLink to="/terms">View Terms</SecondaryTextLink>}
        />
      </AuthCard>
    </AuthShell>
  );
}
