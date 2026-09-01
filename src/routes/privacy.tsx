import { createFileRoute } from "@tanstack/react-router";
import { AuthCard, AuthShell, AuthSupportLinks, PageHeadingBlock, SecondaryTextLink } from "@/components/attendance-hq/host-onboarding";
import { ATTENDANCE_RETENTION_DAYS } from "@/lib/attendance-hq";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Attendance HQ" },
      { name: "description", content: "How Attendance HQ handles host account and student check-in data, including retention and FERPA framing." },
      { property: "og:title", content: "Privacy Policy — Attendance HQ" },
      { property: "og:description", content: "How Attendance HQ handles host account and student check-in data, including retention and FERPA framing." },
      { property: "og:type", content: "website" },
      { name: "twitter:title", content: "Privacy Policy — Attendance HQ" },
      { name: "twitter:description", content: "How Attendance HQ handles host account and student check-in data, including retention and FERPA framing." },
    ],
    links: [{ rel: "canonical", href: "https://attendance-hq.com/privacy" }],
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
          description="A short, honest summary of what data Attendance HQ collects, how long it's kept, and how it fits into campus privacy rules."
        />
        <div className="space-y-4 text-sm leading-6 text-foreground">
          <section className="space-y-1.5">
            <h2 className="font-display text-[15px] font-bold">Educational context (FERPA)</h2>
            <p className="text-muted-foreground">
              Attendance HQ is a tool campus clubs use to run event check-in. Attendance rosters
              collected through this tool may qualify as education-related records under your
              institution's FERPA policies. Hosts are expected to handle these records under the
              rules of their campus student-organization office.
            </p>
          </section>
          <section className="space-y-1.5">
            <h2 className="font-display text-[15px] font-bold">What we collect</h2>
            <p className="text-muted-foreground">
              Host accounts: name, email, and password (hashed) to sign in and manage clubs.
              Student check-in: first name, last name, university email, and student ID number
              (e.g. 900 number), plus the timestamp and method of each check-in. We also store a
              random device token on the student's phone so returning students can check in faster.
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
              event. Campus student-organization staff with an admin role may see aggregate metrics
              (event counts, check-in counts) — never individual student rosters. We do not sell,
              rent, or share attendance data with third parties for advertising.
            </p>
          </section>
          <section className="space-y-1.5">
            <h2 className="font-display text-[15px] font-bold">Retention</h2>
            <p className="text-muted-foreground">
              By default, Attendance HQ keeps check-in history for {ATTENDANCE_RETENTION_DAYS} days
              (roughly two academic years). Club owners can export attendance to CSV at any time and
              delete records older than the retention cutoff from the club's{" "}
              <em>Data &amp; privacy</em> panel. If your institution requires shorter or longer
              retention, the host is expected to follow that campus policy.
            </p>
          </section>
          <section className="space-y-1.5">
            <h2 className="font-display text-[15px] font-bold">Student rights</h2>
            <p className="text-muted-foreground">
              For access, correction, or deletion of your attendance record, contact the club that
              ran the event you attended, or your campus student-organization office. Hosts can
              export a student's check-in history via the semester report and delete a club's copy
              of old attendance via the retention purge.
            </p>
          </section>
          <section className="space-y-1.5">
            <h2 className="font-display text-[15px] font-bold">Subprocessors</h2>
            <p className="text-muted-foreground">
              Attendance HQ runs on Lovable Cloud (application hosting on edge infrastructure) with
              a managed Postgres database and auth provider. These providers process data on our
              behalf to run the service. We don't use ad networks or analytics that profile
              individuals.
            </p>
          </section>
          <section className="space-y-1.5">
            <h2 className="font-display text-[15px] font-bold">Contact</h2>
            <p className="text-muted-foreground">
              For requests about your attendance record, contact the hosting club or your campus
              student-organization office. This page is provided for transparency and is not legal
              advice; your institution's counsel is the final word on FERPA compliance.
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
