import { createFileRoute } from "@tanstack/react-router";
import {
  CalendarRange,
  ClipboardList,
  Clock3,
  FileSpreadsheet,
  GraduationCap,
  Landmark,
  QrCode,
  ShieldCheck,
} from "lucide-react";
import {
  MarketingShell,
  breadcrumbSchema,
  buildPageMeta,
  faqSchema,
  howToSchema,
} from "@/components/marketing/marketing-shell";
import { VerticalPage } from "@/components/marketing/vertical-page";

const OG_IMAGE = "https://attendance-hq.com/__l5e/assets-v1/c341e4a9-19bb-43c6-86d2-488104f847ef/og-attendance-hq.jpg";

const FAQS = [
  { q: "What is the best way for a university department to track attendance?", a: "The fastest method is a QR code check-in that students complete on their own phones. Attendance-HQ gives each session its own QR code and short link, builds a live roster as students scan, and exports a CSV for the department's records — no card readers, no paper sign-in sheets, no per-student license." },
  { q: "How do we track attendance at orientation sessions?", a: "Create one event per orientation session, project the QR code on the room screen, and let students scan as they walk in. Hundreds of students can check in at once because each phone submits independently, and the department gets a timestamped roster per session." },
  { q: "Can we track attendance at a career fair or tabling event?", a: "Yes. Print the event QR code on a table tent and let visitors scan it. Turn on pre-event check-in beforehand to collect an early head count so you know how many employers, chairs, and giveaways to plan for." },
  { q: "Can we require a campus email to check in?", a: "Yes. Set the allowed email domains for your university and check-ins from any other domain are rejected. That keeps advising, orientation, and training rosters limited to actual enrolled students and staff." },
  { q: "Can multiple staff members run sessions for one department?", a: "Yes. The owner invites coordinators and student staff as officers using the email they already sign in with. Officers can create events, run check-in, and export reports, while only the owner can delete the department or transfer ownership." },
  { q: "Does attendance data satisfy FERPA expectations?", a: "Attendance-HQ is designed with FERPA in mind: minimum-necessary fields, roster access scoped to the department's officers, encryption in transit and at rest, a 730-day rolling retention window, and an owner-run purge tool. See the Privacy page and FERPA documentation." },
  { q: "Can we export attendance for grant or assessment reporting?", a: "Yes. Pick any date range and Attendance-HQ builds a student × session matrix from real check-in timestamps, then exports it as a CSV that opens in Excel or Google Sheets for assessment, accreditation, or grant reporting." },
];

const HOW_TO = howToSchema({
  name: "How a university department takes attendance with a QR code",
  description:
    "Track attendance at orientation, advising, training, and career-fair sessions using a QR code and Attendance-HQ.",
  steps: [
    { name: "Create the department", text: "Create your department or program in Attendance-HQ and invite coordinators as officers." },
    { name: "Add the session", text: "Create an event for the session and set the check-in window, or reuse a saved template for recurring sessions." },
    { name: "Project the QR code", text: "Display or print the session's QR code so students can scan it with their phone camera as they arrive." },
    { name: "Export the record", text: "Watch the live roster fill, close the window, and export the session or date-range CSV for department reporting." },
  ],
});

export const Route = createFileRoute("/campus-department-attendance")({
  head: () => {
    const meta = buildPageMeta({
      title: "Campus Department Attendance Tracking — Orientation & Advising | Attendance-HQ",
      description:
        "QR code attendance tracking for university departments: orientation, advising sessions, training, and career fairs. Campus email gating, staff roles, CSV reports.",
      path: "/campus-department-attendance",
      image: OG_IMAGE,
    });
    return {
      ...meta,
      scripts: [
        { type: "application/ld+json", children: JSON.stringify(HOW_TO) },
        { type: "application/ld+json", children: JSON.stringify(faqSchema(FAQS)) },
        {
          type: "application/ld+json",
          children: JSON.stringify(
            breadcrumbSchema([
              { name: "Home", path: "/" },
              { name: "Campus Department Attendance", path: "/campus-department-attendance" },
            ]),
          ),
        },
      ],
    };
  },
  component: () => (
    <MarketingShell>
      <VerticalPage
        eyebrow="For campus departments"
        h1={<>Attendance tracking for <span className="text-primary">university departments.</span></>}
        intro="Orientation sessions, advising appointments, staff training, career fair booths, tutoring hours. One QR code per session, a live roster on your phone, and a CSV your assessment office will accept."
        tldr="Attendance-HQ is a QR code attendance system for university departments and campus offices. Staff create a session, students scan one code from their own phones, and the department exports a timestamped roster or a date-ranged attendance matrix for orientation, advising, training, and assessment reporting."
        steps={[
          { title: "Set up the department", body: "Create your office or program, invite coordinators and student staff as officers, and lock check-in to your campus email domains." },
          { title: "Run every session", body: "Project or print the QR code. Students scan as they enter — hundreds at once, each on their own phone." },
          { title: "Report it out", body: "Export a session CSV or a date-ranged student × session matrix for assessment, accreditation, or grant reporting." },
        ]}
        features={[
          { icon: QrCode, title: "One code per session", body: "Rotate the QR token instantly if a screenshot escapes the room." },
          { icon: GraduationCap, title: "Campus domain gate", body: "Only your university's email domains can check in." },
          { icon: Clock3, title: "Windowed check-in", body: "Open on your schedule, close early with one tap, no late sign-ins." },
          { icon: Landmark, title: "Staff roles", body: "Coordinators run sessions; only the owner can transfer or delete." },
          { icon: CalendarRange, title: "Recurring templates", body: "Save advising or training sessions as templates and duplicate weekly." },
          { icon: FileSpreadsheet, title: "Assessment exports", body: "Date-ranged student × session matrix, CSV for Excel or Sheets." },
          { icon: ClipboardList, title: "Audit trail", body: "Every roster change is logged, with a 730-day retention window." },
          { icon: ShieldCheck, title: "FERPA-aware", body: "Minimum-necessary data and scoped roster access by design." },
        ]}
        scenarios={[
          { title: "Student orientation", body: "One event per session, QR on the projector. Hundreds check in in parallel without a line at the door." },
          { title: "Advising & tutoring hours", body: "A recurring template per week, so you can prove contact hours per student across the whole term." },
          { title: "Career fairs & tabling", body: "Collect an early head count with a promo link, then scan visitors at the booth to measure real turnout." },
        ]}
        faqs={FAQS}
        siblingLinks={[
          { to: "/attendance-reports", label: "Reports & CSV export", hint: "Date-ranged attendance matrix" },
          { to: "/pre-event-headcount", label: "Pre-event head count", hint: "Plan turnout before the session" },
          { to: "/club-officer-roles", label: "Staff roles & privacy", hint: "Shared access, domain gating" },
        ]}
      />
    </MarketingShell>
  ),
});
