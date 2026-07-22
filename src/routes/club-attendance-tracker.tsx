import { createFileRoute } from "@tanstack/react-router";
import { CalendarRange, FileSpreadsheet, GraduationCap, QrCode, ShieldCheck, Sparkles, Users2, WifiOff } from "lucide-react";
import {
  MarketingShell,
  breadcrumbSchema,
  buildPageMeta,
  faqSchema,
} from "@/components/marketing/marketing-shell";
import { VerticalPage } from "@/components/marketing/vertical-page";

const OG_IMAGE = "https://attendance-hq.com/__l5e/assets-v1/c341e4a9-19bb-43c6-86d2-488104f847ef/og-attendance-hq.jpg";

const FAQS = [
  { q: "What is the best attendance tracker for college clubs?", a: "The best club attendance tracker is one members actually use. Attendance-HQ is built for student orgs: it takes attendance with a single QR, produces the semester report SGA usually wants, and doesn't cost the club money." },
  { q: "How do college clubs usually take attendance today?", a: "Most clubs still use a paper sign-in sheet, a Google Form, or a spreadsheet an officer maintains after the fact. All three lose data and are hard to submit to SGA. A QR-based attendance tracker fixes all three problems in one." },
  { q: "Can I export a semester report for SGA?", a: "Yes. The semester report gives you a student × meeting matrix for any date range and downloads as a CSV. Perfect for SGA funding requests, advisor check-ins, or org-of-the-year applications." },
  { q: "Can co-officers manage the club with me?", a: "Yes. Owners invite officers by their existing host email. Officers can run events but can't delete the club or transfer ownership. Ownership can be transferred at any time." },
  { q: "Does it enforce our campus email domain?", a: "Yes. Set the allowed email domains for your university (e.g. ung.edu) and members from other domains are rejected at check-in — no more fake or ineligible sign-ins." },
  { q: "Is Attendance-HQ FERPA-compliant?", a: "Attendance-HQ is designed with FERPA in mind: minimum-necessary data collection, scoped roster access, encryption in transit and at rest, and a 730-day retention window. See our Privacy page and DPA doc." },
];

export const Route = createFileRoute("/club-attendance-tracker")({
  head: () => {
    const meta = buildPageMeta({
      title: "Club Attendance Tracker — Free App for College Clubs | Attendance-HQ",
      description:
        "The attendance tracker built for college clubs. QR check-in, officer roles, semester reports for SGA, and instant CSV — free for your first club.",
      path: "/club-attendance-tracker",
      image: OG_IMAGE,
    });
    return {
      ...meta,
      scripts: [
        { type: "application/ld+json", children: JSON.stringify(faqSchema(FAQS)) },
        { type: "application/ld+json", children: JSON.stringify(breadcrumbSchema([{ name: "Home", path: "/" }, { name: "Club Attendance Tracker", path: "/club-attendance-tracker" }])) },
      ],
    };
  },
  component: () => (
    <MarketingShell>
      <VerticalPage
        eyebrow="For college clubs"
        h1={<>The club attendance tracker <span className="text-primary">SGA will actually accept.</span></>}
        intro="Weekly GBMs, exec meetings, service events. One QR, one roster, one CSV. Stop chasing officers for a sign-in sheet after the fact."
        tldr="Attendance-HQ is a free QR code attendance tracker for college clubs and student organizations. Members check themselves in from their phones, officers see a live roster, and a semester-long attendance report can be exported for SGA in one tap."
        steps={[
          { title: "Add your club", body: "Create the club, invite co-officers by email, tie it to your university." },
          { title: "Run every meeting", body: "Use the pre-seeded weekly-meeting template. QR opens 10 min before, closes on time." },
          { title: "Report to SGA", body: "Download the semester attendance matrix as CSV. Send it. Done." },
        ]}
        features={[
          { icon: QrCode, title: "Frictionless QR", body: "One scan, no student app. Works on iPhone, Android, laptop." },
          { icon: Users2, title: "Officers & owners", body: "Invite officers, transfer ownership, protect the roster." },
          { icon: CalendarRange, title: "Templates", body: "Pre-seeded weekly meeting template. Save any event as a template." },
          { icon: FileSpreadsheet, title: "Semester report", body: "Student × meeting matrix for any date range, CSV export." },
          { icon: GraduationCap, title: "Campus domain gate", body: "Only your school's email domain can check in." },
          { icon: WifiOff, title: "Offline-tolerant", body: "Drafts survive weak dorm Wi-Fi and finish when back online." },
          { icon: ShieldCheck, title: "FERPA-aware", body: "Minimum-necessary data, 730-day retention, scoped access." },
          { icon: Sparkles, title: "Live ops", body: "Watch the roster climb in real time from the host phone." },
        ]}
        scenarios={[
          { title: "Weekly GBM", body: "One template, duplicate next week, done. 40 members in under a minute." },
          { title: "Org-of-the-year application", body: "Semester matrix proves engagement without a spreadsheet spelunk." },
          { title: "Service or philanthropy hours", body: "Log per-event attendance and export exactly what national or SGA needs." },
        ]}
        faqs={FAQS}
        siblingLinks={[
          { to: "/greek-life-attendance", label: "Greek chapters", hint: "Chapter meetings + national reports" },
          { to: "/qr-code-attendance", label: "How QR check-in works", hint: "Product deep dive" },
          { to: "/vs-google-forms", label: "vs Google Forms", hint: "Migration guide" },
        ]}
      />
    </MarketingShell>
  ),
});
