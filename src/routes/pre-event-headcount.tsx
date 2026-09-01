import { createFileRoute } from "@tanstack/react-router";
import {
  BarChart3,
  CalendarRange,
  Clock3,
  Megaphone,
  QrCode,
  ShieldCheck,
  Smartphone,
  Users2,
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
    q: "How do I get a head count before an event?",
    a: "Turn on pre-event check-in when you create the event in Attendance-HQ. You get a separate QR code and link you can post in GroupMe, Instagram, or a flyer. Members tap it to say they're coming, and you watch the early head count grow before the doors open.",
  },
  {
    q: "Does a pre-event check-in count as attendance?",
    a: "No. Pre-event check-ins are stored separately from real attendance, so your official roster and semester report stay accurate. On event day the ops screen shows who pre-checked in and whether each person actually showed up.",
  },
  {
    q: "How long can the pre-check-in window stay open?",
    a: "As long as you want. You choose the start and end of the pre-event window independently of the event's day-of check-in window — hours, days, or weeks of promotion before the meeting.",
  },
  {
    q: "Is this an RSVP tool?",
    a: "Functionally yes — it's a free RSVP and early head count for club events, but built on the same QR check-in flow you use on event day, so nobody needs a second app, account, or download.",
  },
  {
    q: "Can I see who pre-checked in, not just the number?",
    a: "Yes. The event ops screen lists every early head count entry with the time they joined and a Checked in / Not yet badge showing whether they converted into real attendance.",
  },
  {
    q: "How does an early head count help me plan?",
    a: "It tells you how much food to order, which room to book, whether to push more promotion, and what your show-rate looks like. Comparing head count to actual attendance over a semester makes your turnout forecasting a lot less of a guess.",
  },
];

const HOW_TO = howToSchema({
  name: "How to get an early head count for a club event",
  description:
    "Use pre-event check-in in Attendance-HQ to collect a free RSVP head count before your meeting, then compare it to real attendance.",
  steps: [
    { name: "Create the event", text: "Create the event and enable pre-event check-in, setting the pre-check-in window as long as you need." },
    { name: "Share the pre-check-in link", text: "Post the pre-event QR code or short link in your group chat, story, or flyer." },
    { name: "Watch the head count", text: "Members tap in from their phones and the early head count updates live on the host screen." },
    { name: "Compare to who showed up", text: "On event day, check in members with the event QR and compare the head count to real attendance." },
  ],
});

export const Route = createFileRoute("/pre-event-headcount")({
  head: () => {
    const meta = buildPageMeta({
      title: "Pre-Event Head Count & RSVP QR Code for Clubs | Attendance-HQ",
      description:
        "Get a free RSVP head count before your meeting. Share a pre-event QR code, watch early check-ins roll in, then compare head count to who actually showed up.",
      path: "/pre-event-headcount",
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
              { name: "Pre-Event Head Count", path: "/pre-event-headcount" },
            ]),
          ),
        },
      ],
    };
  },
  component: () => (
    <MarketingShell>
      <VerticalPage
        eyebrow="Pre-event check-in"
        h1={<>Know your head count <span className="text-primary">before the doors open.</span></>}
        intro="Post one pre-event QR code while you're promoting the meeting. Members tap to say they're coming, you watch the early head count climb — and on event day you see exactly who followed through."
        tldr="Pre-event check-in is a free RSVP head count for club, chapter, and church events. Hosts share a separate pre-event QR code or link for as long as they want, members tap in from any phone with no download, and the early head count stays separate from official attendance so day-of records stay accurate."
        steps={[
          { title: "Turn it on at event creation", body: "Enable pre-event check-in and set the window — hours, days, or weeks before the meeting." },
          { title: "Promote with the pre-QR", body: "Drop the code or link in GroupMe, an Instagram story, a flyer, or an email blast." },
          { title: "Compare to who showed up", body: "Event day, the ops screen shows head count, real attendance, and who converted." },
        ]}
        features={[
          { icon: Megaphone, title: "Marketing-ready link", body: "A shareable QR and short link made for promo posts, not just the room." },
          { icon: Clock3, title: "Any window length", body: "Open the pre-check-in window as far ahead as you like and close it whenever." },
          { icon: BarChart3, title: "Head count vs showed up", body: "See conversion at a glance so your turnout forecasting gets sharper." },
          { icon: Users2, title: "Named head count", body: "Not just a number — the full early list with join times and status." },
          { icon: QrCode, title: "Separate token", body: "The promo link is its own token, so it never exposes day-of check-in." },
          { icon: ShieldCheck, title: "Clean records", body: "Pre-check-ins never mix into official attendance or the semester report." },
          { icon: Smartphone, title: "No app to install", body: "Runs in any phone browser. One tap, done." },
          { icon: CalendarRange, title: "Works with templates", body: "Duplicate next week's meeting and the pre-event window shifts with it." },
        ]}
        scenarios={[
          { title: "Ordering food for a GBM", body: "Open pre-check-in a week out, watch the count, order pizza for the number you can actually see." },
          { title: "Picking the right room", body: "A 40-person head count means booking the lecture hall, not the study room." },
          { title: "Knowing when to push promo", body: "Head count flat two days out? Post the QR again instead of guessing at turnout." },
        ]}
        faqs={FAQS}
        siblingLinks={[
          { to: "/qr-code-attendance", label: "How QR check-in works", hint: "Day-of attendance deep dive" },
          { to: "/attendance-reports", label: "Attendance reports", hint: "Semester matrix + CSV export" },
          { to: "/club-attendance-tracker", label: "For college clubs", hint: "GBMs, exec meetings, SGA" },
        ]}
      />
    </MarketingShell>
  ),
});
