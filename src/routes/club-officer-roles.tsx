import { createFileRoute } from "@tanstack/react-router";
import {
  ClipboardList,
  Crown,
  KeyRound,
  Lock,
  MailCheck,
  QrCode,
  ShieldCheck,
  Trash2,
  Users2,
} from "lucide-react";
import {
  MarketingShell,
  breadcrumbSchema,
  buildPageMeta,
  faqSchema,
} from "@/components/marketing/marketing-shell";
import { VerticalPage } from "@/components/marketing/vertical-page";

const OG_IMAGE = "https://attendance-hq.com/__l5e/assets-v1/c341e4a9-19bb-43c6-86d2-488104f847ef/og-attendance-hq.jpg";

const FAQS = [
  {
    q: "Can multiple officers manage attendance for the same club?",
    a: "Yes. The club owner invites co-officers by the email they already use to sign in. Officers can create events, run check-in, correct roster entries, and export reports. Only the owner can delete the club or transfer ownership.",
  },
  {
    q: "How do I transfer club ownership to next year's exec?",
    a: "From the club page, the current owner promotes an existing officer to owner. The former owner automatically becomes an officer, so nothing is lost during exec turnover and no data has to be re-created.",
  },
  {
    q: "Can I restrict check-in to my campus email domain?",
    a: "Yes. Set the allowed email domains for your university and anyone using a different domain is rejected at check-in — so guests, alumni, or typo'd addresses never land in your official roster.",
  },
  {
    q: "What happens if our QR code leaks in a group chat?",
    a: "Regenerate the event's QR token. The old link stops working immediately and a fresh code takes its place, so a screenshot that got forwarded can't be used to check in from a dorm room.",
  },
  {
    q: "Who can see member data?",
    a: "Roster access is scoped to the club's owner and officers. Emails are masked in the ops view, every roster change is written to an audit log, and nobody outside the club's membership can read its attendance.",
  },
  {
    q: "Is Attendance-HQ FERPA-friendly?",
    a: "Attendance-HQ is designed with FERPA in mind: minimum-necessary data collection, role-scoped roster access, encryption in transit and at rest, a rolling 730-day retention window, and an owner-run purge tool. See the Privacy page and the DPA documentation for detail.",
  },
  {
    q: "Can I fix a member's misspelled name or email?",
    a: "Yes. Officers can correct a member's name or email directly from the event roster. The correction is validated against your allowed domains and recorded in the audit log.",
  },
];

export const Route = createFileRoute("/club-officer-roles")({
  head: () => {
    const meta = buildPageMeta({
      title: "Officer Roles, Roster Privacy & Ownership Transfer | Attendance-HQ",
      description:
        "Share club attendance with co-officers, transfer ownership at exec turnover, gate check-in to your campus email domain, and keep rosters FERPA-aware.",
      path: "/club-officer-roles",
      image: OG_IMAGE,
    });
    return {
      ...meta,
      scripts: [
        { type: "application/ld+json", children: JSON.stringify(faqSchema(FAQS)) },
        {
          type: "application/ld+json",
          children: JSON.stringify(
            breadcrumbSchema([
              { name: "Home", path: "/" },
              { name: "Officer Roles & Roster Privacy", path: "/club-officer-roles" },
            ]),
          ),
        },
      ],
    };
  },
  component: () => (
    <MarketingShell>
      <VerticalPage
        eyebrow="Officers, ownership & privacy"
        h1={<>Run it as a team. <span className="text-primary">Survive exec turnover.</span></>}
        intro="Invite co-officers by email, transfer ownership in one tap when new exec takes over, gate check-in to your campus domain, and kill leaked QR codes before they cost you a clean roster."
        tldr="Attendance-HQ separates club owners from officers: owners invite and remove officers, transfer ownership, and run retention purges, while officers create events, run check-in, correct roster entries, and export reports. Roster access is scoped to the club's members, campus email domains can be enforced, and every change is written to an audit log."
        steps={[
          { title: "Invite your exec", body: "Add officers by the email they already sign in with. No extra seats, no cost." },
          { title: "Lock down check-in", body: "Set allowed campus email domains and regenerate QR tokens whenever a link leaks." },
          { title: "Hand off in May", body: "Promote next year's president to owner. You stay on as an officer." },
        ]}
        features={[
          { icon: Crown, title: "Owner vs officer", body: "Officers run meetings; only the owner deletes the club or transfers it." },
          { icon: MailCheck, title: "Invite by email", body: "Add co-officers using their existing host account email." },
          { icon: Users2, title: "Ownership transfer", body: "One tap at exec turnover. Nothing gets re-created or lost." },
          { icon: ShieldCheck, title: "Campus domain gate", body: "Only your school's email domains can check in to your events." },
          { icon: QrCode, title: "QR leak controls", body: "Regenerate the event token to invalidate a forwarded screenshot." },
          { icon: Lock, title: "Scoped roster access", body: "Member data is visible only to that club's owner and officers." },
          { icon: ClipboardList, title: "Audit log", body: "Manual adds, removals, and profile corrections all leave a trail." },
          { icon: Trash2, title: "Retention & purge", body: "Rolling 730-day window plus an owner-run delete-older-than tool." },
        ]}
        scenarios={[
          { title: "Four officers, one club", body: "Whoever gets to the room first runs check-in — no shared password, no bottleneck." },
          { title: "Spring exec handoff", body: "Outgoing president promotes the incoming one and stays on to help transition." },
          { title: "A QR code hits the group chat", body: "Regenerate the token mid-meeting and remote check-ins stop instantly." },
        ]}
        faqs={FAQS}
        siblingLinks={[
          { to: "/attendance-reports", label: "Attendance reports", hint: "Semester matrix + CSV" },
          { to: "/qr-code-attendance", label: "How QR check-in works", hint: "Product deep dive" },
          { to: "/greek-life-attendance", label: "For Greek life", hint: "Standards, risk, nationals" },
        ]}
      />
    </MarketingShell>
  ),
});
