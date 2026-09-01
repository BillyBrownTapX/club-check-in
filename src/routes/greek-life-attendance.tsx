import { createFileRoute } from "@tanstack/react-router";
import { BadgeCheck, CalendarRange, ClipboardList, FileSpreadsheet, HeartHandshake, QrCode, ShieldCheck, Users2 } from "lucide-react";
import {
  MarketingShell,
  breadcrumbSchema,
  buildPageMeta,
  faqSchema,
} from "@/components/marketing/marketing-shell";
import { VerticalPage } from "@/components/marketing/vertical-page";

const OG_IMAGE = "https://attendance-hq.com/__l5e/assets-v1/c341e4a9-19bb-43c6-86d2-488104f847ef/og-attendance-hq.jpg";

const FAQS = [
  { q: "What is the best attendance app for fraternities and sororities?", a: "Attendance-HQ is purpose-built for Greek chapters. Weekly chapter meetings, mandatory events, philanthropy hours, and risk-management events all use the same QR check-in flow, and the semester report gives you what national wants without a spreadsheet." },
  { q: "How do I track mandatory chapter meeting attendance?", a: "Create the event, set a check-in window (e.g. 6:50–7:15 for a 7 PM meeting), and share the QR. Members scan from their seats. The roster is timestamped, so late arrivals are visible." },
  { q: "Can I record philanthropy or service hours?", a: "Yes — create an event per shift or drive, share the QR, and export the roster as a CSV with timestamps. Great for chapter service requirements and national submissions." },
  { q: "Can officers manage the chapter together?", a: "The chapter owner invites officers (VP membership, standards, risk, etc.) by email. All officers can run events. Ownership can be transferred to next year's exec at any time." },
  { q: "How does this help with risk management?", a: "Every check-in is timestamped and every roster change is written to an audit log. You get defensible attendance records for mandatory risk-management events and educational programming." },
  { q: "Does it work at events without Wi-Fi?", a: "Members need a data connection to submit, but Attendance-HQ saves each check-in draft locally so a bad signal at the venue doesn't lose their sign-in — it retries automatically when the phone reconnects." },
];

export const Route = createFileRoute("/greek-life-attendance")({
  head: () => {
    const meta = buildPageMeta({
      title: "Greek Life Attendance App — Chapter Meetings & Philanthropy | Attendance-HQ",
      description:
        "QR attendance for fraternity & sorority chapters. Chapter meetings, mandatory events, philanthropy hours, and national-ready semester reports.",
      path: "/greek-life-attendance",
      image: OG_IMAGE,
    });
    return {
      ...meta,
      scripts: [
        { type: "application/ld+json", children: JSON.stringify(faqSchema(FAQS)) },
        { type: "application/ld+json", children: JSON.stringify(breadcrumbSchema([{ name: "Home", path: "/" }, { name: "Greek Life Attendance", path: "/greek-life-attendance" }])) },
      ],
    };
  },
  component: () => (
    <MarketingShell>
      <VerticalPage
        eyebrow="For fraternities & sororities"
        h1={<>Chapter attendance, <span className="text-primary">without the paper roll call.</span></>}
        intro="Weekly chapter, standards, ritual, and philanthropy — all one QR each. Timestamped rosters, national-ready CSV, ownership transfer built for annual exec turnover."
        tldr="Attendance-HQ is a QR attendance app for fraternities and sororities. Chapter meetings, mandatory events, and philanthropy hours are captured with a single scan, and the semester report exports the exact matrix national headquarters usually asks for."
        steps={[
          { title: "Set up your chapter", body: "Create the chapter, add exec as officers, seed a weekly chapter template." },
          { title: "Take attendance at chapter", body: "Project the QR. Members scan. Windowed check-in flags late arrivals." },
          { title: "Report to nationals", body: "Pull the semester matrix, export CSV, submit. Every event is timestamped." },
        ]}
        features={[
          { icon: BadgeCheck, title: "Timestamped roster", body: "Every scan carries a server timestamp — defensible for standards and risk." },
          { icon: HeartHandshake, title: "Philanthropy hours", body: "One event per shift. Export the roster for national submission." },
          { icon: Users2, title: "Exec-turnover safe", body: "Transfer chapter ownership to next year's president in one tap." },
          { icon: ClipboardList, title: "Audit log", body: "Every roster change and QR regeneration is logged for standards board." },
          { icon: QrCode, title: "Rotatable QR", body: "Regenerate the QR token any time a link leaks to a group chat." },
          { icon: FileSpreadsheet, title: "Semester CSV", body: "Full matrix export for the exact date range HQ requests." },
          { icon: ShieldCheck, title: "Domain-gated", body: "Enforce your campus email domain so only members can check in." },
          { icon: CalendarRange, title: "Recurring templates", body: "Weekly chapter, exec, standards — one template each." },
        ]}
        scenarios={[
          { title: "Mandatory chapter meeting", body: "6:50 PM window opens. QR on the projector. Rush the door — everyone scans in from their seat." },
          { title: "Risk-management education", body: "Document exactly who attended the required session with a timestamped, exportable roster." },
          { title: "Fall recruitment events", body: "Track PNM attendance across every round without a paper clipboard." },
        ]}
        faqs={FAQS}
        siblingLinks={[
          { to: "/attendance-reports", label: "Reports for nationals", hint: "Semester matrix + CSV" },
          { to: "/pre-event-headcount", label: "Pre-event head count", hint: "Know your turnout early" },
          { to: "/club-officer-roles", label: "Officers & ownership", hint: "Exec turnover in one tap" },
        ]}
      />
    </MarketingShell>
  ),
});
