import { createFileRoute } from "@tanstack/react-router";
import {
  BarChart3,
  CalendarRange,
  ClipboardList,
  Download,
  FileSpreadsheet,
  Landmark,
  ShieldCheck,
  Table2,
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
  {
    q: "How do I make a semester attendance report for a club?",
    a: "In Attendance-HQ, open the club, pick a date range, and the semester report builds a student × meeting matrix of every event in that range. One tap downloads it as a CSV you can hand to SGA, an advisor, or a national office.",
  },
  {
    q: "Can I export attendance to Excel or Google Sheets?",
    a: "Yes. Every per-event roster and every semester report exports as a CSV that opens cleanly in Excel, Numbers, and Google Sheets — no formatting cleanup, no copy-paste from a form response tab.",
  },
  {
    q: "What is a student attendance matrix?",
    a: "It's a grid with one row per member and one column per meeting, marking who attended which event. It's the format most student government offices, advisors, and national headquarters ask for, and it's what Attendance-HQ generates automatically.",
  },
  {
    q: "Do I need an attendance spreadsheet template?",
    a: "No. Templates break the moment someone edits the wrong cell. Attendance-HQ builds the spreadsheet from real timestamped check-ins, so the export is the source of truth rather than a hand-maintained copy of it.",
  },
  {
    q: "Can I report attendance for a custom date range?",
    a: "Yes. Pick any start and end date — a semester, a quarter, a month, a single week of recruitment, or the full year — and the report and CSV cover exactly that range.",
  },
  {
    q: "Does the report include check-in times and method?",
    a: "Per-event exports include each member's name, email, ID number, check-in timestamp, and whether they scanned the QR or were added manually by a host. Semester reports summarize attendance across every meeting in the range.",
  },
  {
    q: "How long is attendance data kept?",
    a: "Attendance history is retained on a rolling 730-day window (about two academic years), and club owners can purge older records earlier. Export regularly if your campus policy requires longer retention.",
  },
];

const HOW_TO = howToSchema({
  name: "How to create a semester attendance report",
  description:
    "Build a student-by-meeting attendance matrix for any date range in Attendance-HQ and export it as a CSV.",
  steps: [
    { name: "Open the club", text: "Open the club whose attendance you need to report on." },
    { name: "Choose a date range", text: "Set the start and end dates for the semester, quarter, or period you're reporting." },
    { name: "Review the matrix", text: "Review the student by meeting attendance matrix generated from real check-ins." },
    { name: "Export the CSV", text: "Download the CSV and send it to SGA, your advisor, or your national office." },
  ],
});

export const Route = createFileRoute("/attendance-reports")({
  head: () => {
    const meta = buildPageMeta({
      title: "Semester Attendance Reports & CSV Export | Attendance-HQ",
      description:
        "Build a student × meeting attendance matrix for any date range and export it to Excel or Google Sheets in one tap — SGA, advisor, and nationals ready.",
      path: "/attendance-reports",
      image: OG_IMAGE,
    });
    return {
      ...meta,
      scripts: [
        { type: "application/ld+json", children: JSON.stringify(faqSchema(FAQS)) },
        { type: "application/ld+json", children: JSON.stringify(HOW_TO) },
        {
          type: "application/ld+json",
          children: JSON.stringify(
            breadcrumbSchema([
              { name: "Home", path: "/" },
              { name: "Attendance Reports", path: "/attendance-reports" },
            ]),
          ),
        },
      ],
    };
  },
  component: () => (
    <MarketingShell>
      <VerticalPage
        eyebrow="Reports & exports"
        h1={<>The attendance report <span className="text-primary">your advisor already asked for.</span></>}
        intro="A student × meeting matrix for any date range, built from real timestamped check-ins and exported as a CSV in one tap. No spreadsheet maintenance, no form-response cleanup."
        tldr="Attendance-HQ turns every check-in into reportable data: a per-event roster export and a semester attendance report that lays out members down the rows and meetings across the columns for any date range. Both download as CSV files that open directly in Excel, Numbers, and Google Sheets."
        steps={[
          { title: "Run your meetings", body: "Members scan the event QR. Every check-in is timestamped automatically." },
          { title: "Pick a date range", body: "Semester, quarter, month, recruitment week — any start and end you need." },
          { title: "Export and send it", body: "One tap gives you the CSV. Attach it to the SGA form and move on." },
        ]}
        features={[
          { icon: Table2, title: "Student × meeting matrix", body: "Members down the side, meetings across the top. The format offices ask for." },
          { icon: FileSpreadsheet, title: "Clean CSV", body: "Opens correctly in Excel, Numbers, and Google Sheets. No cleanup." },
          { icon: CalendarRange, title: "Any date range", body: "Report on a week, a semester, or the whole year." },
          { icon: Download, title: "Per-event export too", body: "Name, email, ID, timestamp, and check-in method for a single meeting." },
          { icon: BarChart3, title: "Engagement at a glance", body: "See who's consistent, who's fading, and where turnout dips." },
          { icon: Landmark, title: "Built for SGA & nationals", body: "Funding requests, org-of-the-year applications, HQ submissions." },
          { icon: ClipboardList, title: "Audit trail", body: "Manual adds, removals, and profile corrections are all logged." },
          { icon: ShieldCheck, title: "Retention controls", body: "Rolling 730-day window with an owner-run purge when you need it." },
        ]}
        scenarios={[
          { title: "SGA funding request", body: "Attach a semester matrix that proves engagement instead of a hand-typed count." },
          { title: "Advisor check-in", body: "Send one CSV covering every meeting since August in under a minute." },
          { title: "Officer accountability", body: "Show exec attendance across the term without maintaining a side spreadsheet." },
        ]}
        faqs={FAQS}
        siblingLinks={[
          { to: "/vs-google-forms", label: "vs Google Forms", hint: "Why form responses aren't a report" },
          { to: "/club-attendance-tracker", label: "For college clubs", hint: "GBMs and SGA reporting" },
          { to: "/club-officer-roles", label: "Officers & privacy", hint: "Who can see the roster" },
        ]}
      />
    </MarketingShell>
  ),
});
