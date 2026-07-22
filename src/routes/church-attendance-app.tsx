import { createFileRoute } from "@tanstack/react-router";
import { CalendarRange, Church, ClipboardList, FileSpreadsheet, HeartHandshake, QrCode, ShieldCheck, Users2 } from "lucide-react";
import {
  MarketingShell,
  breadcrumbSchema,
  buildPageMeta,
  faqSchema,
} from "@/components/marketing/marketing-shell";
import { VerticalPage } from "@/components/marketing/vertical-page";

const OG_IMAGE = "https://attendance-hq.com/__l5e/assets-v1/c341e4a9-19bb-43c6-86d2-488104f847ef/og-attendance-hq.jpg";

const FAQS = [
  { q: "Is there a free attendance app for churches?", a: "Yes. Attendance-HQ is free for the first group. Churches use it for weekly services, small groups, youth events, and volunteer teams. There's no per-attendee cost." },
  { q: "How do small groups take attendance without a laptop?", a: "The leader creates the event on their phone, taps 'Share QR,' and passes their phone or projects the code. Members scan and confirm. No laptop, no sign-in sheet." },
  { q: "Can I track weekly service attendance over time?", a: "Yes. Save your Sunday service as a template, duplicate it each week, and pull a date-ranged attendance matrix any time — great for pastoral care follow-ups and annual reports." },
  { q: "Does it work for nonprofits, gyms, or K-12 clubs?", a: "Absolutely. Any recurring gathering that needs a reliable roster works — nonprofit volunteer shifts, gym class attendance, K-12 clubs, homeschool co-ops, community sports." },
  { q: "Is member data private?", a: "Yes. Attendance-HQ collects the minimum data needed for a roster, scopes access to the group's leaders, encrypts everything in transit, and enforces a rolling retention window." },
  { q: "Can multiple leaders manage a group?", a: "Yes. The group owner invites co-leaders by email. Ownership can be transferred at any time — helpful when leadership rotates." },
];

export const Route = createFileRoute("/church-attendance-app")({
  head: () => {
    const meta = buildPageMeta({
      title: "Church & Community Attendance App — Free QR Check-in | Attendance-HQ",
      description:
        "Free QR attendance for churches, small groups, nonprofits, gyms, and K-12 clubs. One code, live roster, CSV export — no member downloads.",
      path: "/church-attendance-app",
      image: OG_IMAGE,
    });
    return {
      ...meta,
      scripts: [
        { type: "application/ld+json", children: JSON.stringify(faqSchema(FAQS)) },
        { type: "application/ld+json", children: JSON.stringify(breadcrumbSchema([{ name: "Home", path: "/" }, { name: "Church & Community Attendance App", path: "/church-attendance-app" }])) },
      ],
    };
  },
  component: () => (
    <MarketingShell>
      <VerticalPage
        eyebrow="For churches & community orgs"
        h1={<>The attendance app <span className="text-primary">for every recurring gathering.</span></>}
        intro="Weekly services, small groups, youth nights, volunteer shifts, community classes. One QR, one roster, one CSV — free for your first group."
        tldr="Attendance-HQ is a free QR attendance app for churches, nonprofits, gyms, K-12 clubs, and community organizations. Members scan a single QR code to check themselves in, and leaders get a live roster plus an instant CSV export for follow-ups and reports."
        steps={[
          { title: "Create your group", body: "Church, ministry, nonprofit, gym, club — set it up in under a minute." },
          { title: "Run every gathering", body: "Save your weekly service or class as a template. Duplicate each week." },
          { title: "Follow up smarter", body: "Export attendance to Excel or Sheets. See who's new, who's missing, who to call." },
        ]}
        features={[
          { icon: QrCode, title: "One QR per gathering", body: "Project it, print it, share it in your group chat — same result." },
          { icon: Church, title: "Recurring templates", body: "Save Sunday service or weekly class once. Duplicate on tap." },
          { icon: Users2, title: "Multiple leaders", body: "Invite co-leaders. Transfer ownership when leadership rotates." },
          { icon: ClipboardList, title: "Live roster", body: "Watch attendance climb from your phone during the service." },
          { icon: FileSpreadsheet, title: "CSV exports", body: "Instant download for pastoral care lists and annual reports." },
          { icon: HeartHandshake, title: "Volunteer shifts", body: "Log serving hours per shift for reports and recognition." },
          { icon: ShieldCheck, title: "Private by default", body: "Minimum-necessary data, scoped access, rolling retention." },
          { icon: CalendarRange, title: "Windowed check-in", body: "Open 15 min before, close automatically when the service starts." },
        ]}
        scenarios={[
          { title: "Sunday service", body: "QR on the bulletin. Regulars check in on autopilot. New guests fill a short form once." },
          { title: "Small group / life group", body: "The leader shares the QR in the group chat. Attendance auto-rolls into the semester view." },
          { title: "Volunteer shifts", body: "One event per shift. Roster + hours in a CSV your ops director already knows how to open." },
        ]}
        faqs={FAQS}
        siblingLinks={[
          { to: "/qr-code-attendance", label: "How QR check-in works", hint: "Product deep dive" },
          { to: "/club-attendance-tracker", label: "For college clubs", hint: "GBMs, exec meetings, SGA reports" },
          { to: "/vs-google-forms", label: "vs Google Forms", hint: "Migration guide" },
        ]}
      />
    </MarketingShell>
  ),
});
