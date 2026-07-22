import { createFileRoute } from "@tanstack/react-router";
import { CalendarRange, Clock3, Download, FileSpreadsheet, QrCode, ShieldCheck, Smartphone, WifiOff } from "lucide-react";
import {
  MarketingShell,
  breadcrumbSchema,
  buildPageMeta,
  faqSchema,
} from "@/components/marketing/marketing-shell";
import { VerticalPage } from "@/components/marketing/vertical-page";

const OG_IMAGE = "https://attendance-hq.com/__l5e/assets-v1/c341e4a9-19bb-43c6-86d2-488104f847ef/og-attendance-hq.jpg";

const FAQS = [
  { q: "How does a QR code attendance app work?", a: "A host creates an event in Attendance-HQ and shares a unique QR code. Members scan the code with their phone camera, confirm their identity in the browser, and are marked present in a live roster. No app install is required on the member's device." },
  { q: "Is QR code attendance secure?", a: "Yes. Each event has a rotatable QR token, check-in windows can be closed early, university email domains can be enforced, and every action is written to an audit log. Hosts can regenerate the QR token if a link leaks." },
  { q: "Can I use QR attendance without internet on the member's device?", a: "Members need a data connection to submit, but Attendance-HQ saves their draft locally so a dropped signal doesn't lose their info — it retries when they reconnect." },
  { q: "How is this better than a Google Form?", a: "Google Forms was built for surveys, not attendance. Attendance-HQ gives you rosters, semester reports, officer permissions, offline-tolerant check-in, and one-tap CSV exports out of the box." },
  { q: "Does Attendance-HQ work for large events?", a: "Yes. Attendance-HQ has been load-tested for 100–200 concurrent check-ins per event and rate-limits protect against abuse. Larger events run smoothly on the standard tier." },
  { q: "What phones and browsers are supported?", a: "Any modern iPhone, Android, iPad, or laptop browser with a camera. The check-in page is a progressive web app; members can add it to their home screen for one-tap re-entry." },
];

export const Route = createFileRoute("/qr-code-attendance")({
  head: () => {
    const meta = buildPageMeta({
      title: "QR Code Attendance App — Free, Mobile, No Downloads | Attendance-HQ",
      description:
        "Attendance-HQ is a free QR code attendance app. Members scan one code to check in — no downloads, offline-tolerant, live roster, instant CSV export.",
      path: "/qr-code-attendance",
      image: OG_IMAGE,
    });
    return {
      ...meta,
      scripts: [
        { type: "application/ld+json", children: JSON.stringify(faqSchema(FAQS)) },
        { type: "application/ld+json", children: JSON.stringify(breadcrumbSchema([{ name: "Home", path: "/" }, { name: "QR Code Attendance", path: "/qr-code-attendance" }])) },
      ],
    };
  },
  component: () => (
    <MarketingShell>
      <VerticalPage
        eyebrow="QR code attendance"
        h1={<>The QR code attendance app <span className="text-primary">members actually use.</span></>}
        intro="Share one QR code. Members scan it from their own phones and confirm who they are. You get a real-time roster and a clean CSV — every time."
        tldr="A QR code attendance app lets a host share one scannable code so members can check themselves in from any phone browser — no downloads, no shared devices, no paper sign-in. Attendance-HQ does this in seconds and gives hosts a live roster plus one-tap CSV export."
        steps={[
          { title: "Create the event", body: "Name it, pick a check-in window, optionally load a saved template. Takes 15 seconds." },
          { title: "Share the QR", body: "Project it, drop it in your group chat, or print it. One code per event, regeneratable any time." },
          { title: "Watch check-ins roll in", body: "Members scan, confirm, done. You see the roster fill live and close early with one tap." },
        ]}
        features={[
          { icon: QrCode, title: "One code per event", body: "Regenerate the token any time to invalidate leaked links." },
          { icon: Smartphone, title: "No app for members", body: "Runs in the browser. Add-to-home-screen for repeat check-in." },
          { icon: WifiOff, title: "Offline-tolerant", body: "Drafts survive dropped Wi-Fi and submit when the signal returns." },
          { icon: Clock3, title: "Windowed check-in", body: "Open, upcoming, and closed states. Close early with one tap." },
          { icon: FileSpreadsheet, title: "Instant CSV", body: "Per-event export ready for Excel, Sheets, or your SGA report." },
          { icon: ShieldCheck, title: "Email domain gate", body: "Enforce ung.edu or your campus domain to keep the list clean." },
          { icon: CalendarRange, title: "Templates", body: "Save any event as a template. Duplicate next week's meeting instantly." },
          { icon: Download, title: "Semester report", body: "Roll all events into a student × meeting matrix — as CSV." },
        ]}
        scenarios={[
          { title: "General body meeting", body: "Project the QR on the room screen and open the check-in window at 6:55 for a 7 PM meeting." },
          { title: "Career fair booth", body: "Print the QR at the table. Every visitor becomes a lead you can email." },
          { title: "Training or workshop", body: "Post the QR in the calendar invite. The host page tracks who showed up." },
        ]}
        faqs={FAQS}
        siblingLinks={[
          { to: "/club-attendance-tracker", label: "For college clubs", hint: "Weekly meetings, SGA reporting" },
          { to: "/greek-life-attendance", label: "For Greek life", hint: "Chapter, philanthropy, risk" },
          { to: "/vs-google-forms", label: "vs Google Forms", hint: "Side-by-side comparison" },
        ]}
      />
    </MarketingShell>
  ),
});
