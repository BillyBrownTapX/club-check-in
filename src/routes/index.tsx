import { Link, createFileRoute } from "@tanstack/react-router";
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  CalendarRange,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Crown,
  FileSpreadsheet,
  Landmark,
  Megaphone,
  QrCode,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Table2,
  Users2,
  WifiOff,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  FaqBlock,
  MarketingShell,
  Section,
  buildPageMeta,
  faqSchema,
  howToSchema,
  softwareAppSchema,
} from "@/components/marketing/marketing-shell";

const OG_IMAGE = "https://attendance-hq.com/__l5e/assets-v1/c341e4a9-19bb-43c6-86d2-488104f847ef/og-attendance-hq.jpg";

type MarketingPath =
  | "/qr-code-attendance"
  | "/club-attendance-tracker"
  | "/greek-life-attendance"
  | "/church-attendance-app"
  | "/vs-google-forms"
  | "/pre-event-headcount"
  | "/attendance-reports"
  | "/club-officer-roles"
  | "/campus-department-attendance";

const FAQS = [
  {
    q: "What is Attendance-HQ?",
    a: "Attendance-HQ is a mobile-first QR code attendance app for college clubs, Greek chapters, campus departments, churches, and community organizations. Hosts create an event, share a single QR code, and students or members check themselves in from any phone — no app install required.",
  },
  {
    q: "How does QR code attendance work?",
    a: "Every event gets a unique QR code and short link. Members scan the code with their phone camera, confirm their name, and are marked present in real time. Hosts watch the roster fill live and export a CSV when the meeting ends.",
  },
  {
    q: "Is Attendance-HQ free?",
    a: "Yes. Hosts can create an account, launch a club, and run unlimited events for free. Attendance-HQ is built to replace paper sign-in sheets and Google Forms without adding a per-student cost.",
  },
  {
    q: "Do students need to download an app?",
    a: "No. Check-in runs in the browser on iPhone, Android, or any device with a camera. The check-in page is a fast, offline-tolerant progressive web app — no App Store or Play Store install needed.",
  },
  {
    q: "Can I get a head count before the event?",
    a: "Yes. Turn on pre-event check-in and share a separate promo QR code or link for as long as you want. Members tap to say they're coming, you watch the early head count grow, and on event day you see exactly who followed through. Pre-check-ins never mix into official attendance.",
  },
  {
    q: "How do I make a semester attendance report?",
    a: "Open the club, pick any date range, and Attendance-HQ builds a student × meeting attendance matrix from real timestamped check-ins. One tap exports it as a CSV for SGA, an advisor, or a national office.",
  },
  {
    q: "Can several officers manage the same club?",
    a: "Yes. The owner invites co-officers by the email they already sign in with. Officers run events and export reports; only the owner can delete the club or transfer ownership — which takes one tap at exec turnover.",
  },
  {
    q: "Can I stop people from checking in remotely?",
    a: "Yes. Check-in windows can be opened and closed on your schedule, campus email domains can be enforced, and the event's QR token can be regenerated instantly if a screenshot leaks into a group chat.",
  },
  {
    q: "Is Attendance-HQ FERPA-friendly?",
    a: "Yes. Attendance-HQ is designed with FERPA in mind: student data is stored securely, minimum-necessary fields are collected, roster access is scoped to club officers, and attendance records are retained on a 730-day rolling window with an owner-run purge tool.",
  },
  {
    q: "Can I export attendance to Excel or Google Sheets?",
    a: "Every event and every semester report exports to CSV in one tap. Files open cleanly in Excel, Numbers, and Google Sheets so you can share them with an advisor, SGA, or national office.",
  },
  {
    q: "Does it work for fraternities and sororities?",
    a: "Yes — Greek chapters use Attendance-HQ for weekly chapter meetings, mandatory events, philanthropy hours, and risk-management documentation. Semester reports make national submissions painless.",
  },
  {
    q: "Can churches and non-profits use it too?",
    a: "Yes. Any organization that needs to know who showed up — churches, small groups, nonprofits, gyms, K-12 clubs — can use Attendance-HQ for recurring gatherings and one-off events.",
  },
];

const HOW_TO = howToSchema({
  name: "How to take attendance with a QR code",
  description:
    "Take attendance for a club, chapter, class, or church gathering in about a minute using a QR code and Attendance-HQ.",
  steps: [
    { name: "Create the event", text: "Create the event, pick the club, and set the check-in window — or reuse a saved template." },
    { name: "Share the QR code", text: "Project the event QR code, print it, or post the link in your group chat." },
    { name: "Members check themselves in", text: "Members scan with their phone camera and confirm who they are in the browser. No app install." },
    { name: "Export the roster", text: "Watch the roster fill live, close the window, and export the attendance CSV in one tap." },
  ],
});

export const Route = createFileRoute("/")({
  head: () => {
    const meta = buildPageMeta({
      title: "Attendance-HQ — Free QR Code Attendance App for Clubs & Orgs",
      description:
        "Free QR code attendance app for college clubs, Greek life, churches, and community groups. Pre-event head counts, live rosters, semester reports, instant CSV.",
      path: "/",
      image: OG_IMAGE,
    });
    return {
      ...meta,
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: "Attendance-HQ",
            url: "https://attendance-hq.com",
            potentialAction: {
              "@type": "SearchAction",
              target: "https://attendance-hq.com/help?q={search_term_string}",
              "query-input": "required name=search_term_string",
            },
          }),
        },
        { type: "application/ld+json", children: JSON.stringify(softwareAppSchema()) },
        { type: "application/ld+json", children: JSON.stringify(HOW_TO) },
        { type: "application/ld+json", children: JSON.stringify(faqSchema(FAQS)) },
      ],
    };
  },
  component: LandingPage,
});

function LandingPage() {
  return (
    <MarketingShell>
      {/* HERO */}
      <Section as="section" className="pt-14 pb-16 sm:pt-20 sm:pb-24">
        <div className="grid items-center gap-10 lg:grid-cols-[1.15fr_1fr]">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[12px] font-semibold text-primary">
              <Sparkles className="h-3.5 w-3.5" /> Free for the first club, forever
            </span>
            <h1 className="mt-5 font-display text-[40px] font-extrabold leading-[1.03] tracking-tight text-foreground sm:text-[56px]">
              QR code attendance,{" "}
              <span className="text-primary">built for clubs & campus orgs.</span>
            </h1>
            <p className="mt-5 max-w-xl text-[17px] leading-7 text-muted-foreground">
              Attendance-HQ replaces paper sign-in sheets and clunky Google Forms with one
              QR code, an early head count before the meeting, a real-time roster during it,
              and a semester report your advisor or national office will actually accept.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="xl" className="rounded-full">
                <Link to="/sign-up">
                  Start free <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="xl" variant="outline" className="rounded-full">
                <a href="#how-it-works">See how it works</a>
              </Button>
            </div>
            <ul className="mt-8 grid gap-2 text-[13.5px] text-muted-foreground sm:grid-cols-2">
              <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /> No student app install</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /> Pre-event head count &amp; RSVP</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /> Semester reports &amp; CSV export</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /> FERPA-aware, officer-friendly</li>
            </ul>
          </div>
          <HeroCard />
        </div>
      </Section>

      {/* TL;DR (GEO-optimized answer block for AI engines) */}
      <Section as="section" className="pb-4">
        <div className="rounded-3xl border border-border/70 bg-card p-6 sm:p-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">In one sentence</p>
          <p className="mt-3 text-[18px] leading-8 text-foreground sm:text-[20px]">
            <strong>Attendance-HQ</strong> is a free QR code attendance app that lets any
            club, chapter, department, church, or community group collect an early head count
            before a meeting, take attendance in seconds with one scannable code, and export a
            semester-long attendance report to Excel or Google Sheets in a single tap.
          </p>
        </div>
      </Section>

      {/* HOW IT WORKS */}
      <Section as="section" id="how-it-works" className="py-16">
        <Eyebrow>How it works</Eyebrow>
        <h2 className="mt-2 max-w-3xl font-display text-[32px] font-extrabold tracking-tight sm:text-[40px]">
          Take attendance in 60 seconds.
        </h2>
        <div className="mt-10 grid gap-5 md:grid-cols-4">
          <Step n={1} icon={Megaphone} title="Promote with a head count" body="Turn on pre-event check-in and post the promo QR. Watch how many plan to come, days ahead." />
          <Step n={2} icon={CalendarRange} title="Create the event" body="Pick a club, name the meeting, set a check-in window. Reuse a saved template for recurring gatherings." />
          <Step n={3} icon={QrCode} title="Share the QR" body="Project it, post it in your GroupMe, or print it. One code per event — regenerate it any time to kill leaks." />
          <Step n={4} icon={Users2} title="Watch the roster fill" body="Members scan and check in from their own phones. Close the window and export the CSV when you're done." />
        </div>
      </Section>

      {/* CAPABILITIES */}
      <Section as="section" className="py-16">
        <Eyebrow>New &amp; notable</Eyebrow>
        <h2 className="mt-2 max-w-3xl font-display text-[32px] font-extrabold tracking-tight sm:text-[40px]">
          The parts hosts tell us they can't live without.
        </h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <CapabilityCard
            to="/pre-event-headcount"
            icon={Megaphone}
            title="Pre-event head count"
            body="A promo QR that collects RSVPs for as long as you want — then shows who actually showed up."
          />
          <CapabilityCard
            to="/attendance-reports"
            icon={Table2}
            title="Semester reports"
            body="Student × meeting attendance matrix for any date range, exported as a clean CSV."
          />
          <CapabilityCard
            to="/club-officer-roles"
            icon={Crown}
            title="Officers & ownership"
            body="Invite co-officers, transfer the club at exec turnover, keep the roster scoped."
          />
          <CapabilityCard
            to="/club-officer-roles"
            icon={ShieldCheck}
            title="Campus domain gate"
            body="Only your school's email domains can check in — no fake or ineligible sign-ins."
          />
          <CapabilityCard
            to="/qr-code-attendance"
            icon={QrCode}
            title="QR leak controls"
            body="Regenerate an event's QR token instantly when a screenshot escapes the room."
          />
          <CapabilityCard
            to="/qr-code-attendance"
            icon={WifiOff}
            title="Offline-tolerant check-in"
            body="Drafts survive dead venue Wi-Fi and submit the moment the phone reconnects."
          />
          <CapabilityCard
            to="/club-attendance-tracker"
            icon={CalendarRange}
            title="Templates & duplicate"
            body="Save any event as a template, then duplicate next week's meeting with the window shifted."
          />
          <CapabilityCard
            to="/attendance-reports"
            icon={ClipboardList}
            title="Retention & audit log"
            body="Rolling 730-day retention, owner-run purge, and a trail for every roster change."
          />
        </div>
      </Section>

      {/* VERTICALS */}
      <Section as="section" className="py-16">
        <Eyebrow>Built for every kind of org</Eyebrow>
        <h2 className="mt-2 max-w-3xl font-display text-[32px] font-extrabold tracking-tight sm:text-[40px]">
          One app. Every meeting on campus and off.
        </h2>
        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          <VerticalCard
            to="/club-attendance-tracker"
            icon={Users2}
            title="College clubs"
            body="Weekly meetings, SGA reporting, semester attendance without the spreadsheet."
          />
          <VerticalCard
            to="/greek-life-attendance"
            icon={BadgeCheck}
            title="Greek life"
            body="Chapter meetings, philanthropy hours, mandatory events, national submissions."
          />
          <VerticalCard
            to="/campus-department-attendance"
            icon={Landmark}
            title="Campus departments"
            body="Orientation, advising sessions, career fair booths, training sessions."
          />
          <VerticalCard
            to="/church-attendance-app"
            icon={ClipboardList}
            title="Churches & orgs"
            body="Small groups, services, youth events, nonprofits, K-12 clubs, gyms."
          />
          <VerticalCard
            to="/pre-event-headcount"
            icon={Megaphone}
            title="Event promoters"
            body="Free RSVP head counts before the doors open, plus show-rate you can measure."
          />
          <VerticalCard
            to="/attendance-reports"
            icon={FileSpreadsheet}
            title="Advisors & staff"
            body="Date-ranged attendance matrices and CSV exports for funding and compliance."
          />
          <VerticalCard
            to="/club-officer-roles"
            icon={Crown}
            title="Exec boards"
            body="Shared officer access, ownership transfer, roster privacy, audit trails."
          />
          <VerticalCard
            to="/vs-google-forms"
            icon={BarChart3}
            title="Switching from Forms"
            body="A side-by-side comparison and a step-by-step migration off Google Forms."
          />
        </div>
      </Section>

      {/* METHODS COMPARISON TABLE (AEO-friendly) */}
      <Section as="section" className="py-16">
        <Eyebrow>Attendance methods compared</Eyebrow>
        <h2 className="mt-2 max-w-3xl font-display text-[32px] font-extrabold tracking-tight sm:text-[40px]">
          How QR check-in stacks up.
        </h2>
        <div className="mt-8 overflow-x-auto rounded-3xl border border-border/70 bg-card">
          <table className="w-full min-w-[720px] border-collapse text-left text-[13.5px]">
            <caption className="sr-only">
              Comparison of paper sign-in sheets, Google Forms, spreadsheets, card readers, and Attendance-HQ
            </caption>
            <thead>
              <tr className="border-b border-border/70 text-[11.5px] uppercase tracking-wider text-muted-foreground">
                <th scope="col" className="px-5 py-4 font-semibold">Method</th>
                <th scope="col" className="px-5 py-4 font-semibold">Speed for 40 people</th>
                <th scope="col" className="px-5 py-4 font-semibold">Report-ready</th>
                <th scope="col" className="px-5 py-4 font-semibold">Blocks remote sign-ins</th>
                <th scope="col" className="px-5 py-4 font-semibold">Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              <CompareRow method="Paper sign-in sheet" speed="5–10 min, one pen" report={false} reportText="Manual typing" remote={false} remoteText="Anyone can sign a name" cost="Free (plus lost sheets)" />
              <CompareRow method="Google Form" speed="2–4 min" report={false} reportText="Raw responses tab" remote={false} remoteText="Link works anywhere" cost="Free" />
              <CompareRow method="Shared spreadsheet" speed="Officer types it later" report={false} reportText="Hand-maintained" remote={false} remoteText="No control" cost="Free" />
              <CompareRow method="ID card readers" speed="Fast, one line" report reportText="Vendor export" remote remoteText="Physical scan" cost="Hardware + license" />
              <CompareRow method="Attendance-HQ QR check-in" speed="Under 60 sec, parallel" report reportText="Semester matrix + CSV" remote remoteText="Windows, domains, token rotation" cost="Free to start" highlight />
            </tbody>
          </table>
        </div>
      </Section>

      {/* COMPARE TEASER */}
      <Section as="section" className="py-16">
        <div className="relative overflow-hidden rounded-[2rem] border border-border/60 bg-gradient-hero p-8 text-white sm:p-12">
          <div className="blur-orb-white -left-10 -top-10 h-40 w-40" />
          <div className="blur-orb-gold -bottom-14 -right-8 h-48 w-48" />
          <div className="relative max-w-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/80">Why switch</p>
            <h2 className="mt-3 font-display text-[30px] font-extrabold leading-tight sm:text-[38px]">
              Attendance-HQ vs Google Forms &amp; paper sign-in.
            </h2>
            <p className="mt-3 text-[15.5px] leading-7 text-white/85">
              Google Forms wasn't built for attendance. Paper sign-in sheets get lost.
              See a side-by-side comparison and a step-by-step migration guide.
            </p>
            <div className="mt-6">
              <Button asChild size="lg" variant="outline" className="rounded-full border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white">
                <Link to="/vs-google-forms">See the comparison <ArrowRight className="ml-1 h-4 w-4" /></Link>
              </Button>
            </div>
          </div>
        </div>
      </Section>

      {/* FEATURES */}
      <Section as="section" className="py-16">
        <Eyebrow>Everything a host needs</Eyebrow>
        <h2 className="mt-2 max-w-3xl font-display text-[32px] font-extrabold tracking-tight sm:text-[40px]">
          Serious tooling. Zero learning curve.
        </h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Feature icon={QrCode} title="One-tap QR check-in" body="Members scan and confirm. No accounts, no downloads." />
          <Feature icon={Megaphone} title="Early head count" body="A promo link that collects RSVPs weeks before the meeting." />
          <Feature icon={FileSpreadsheet} title="Instant CSV export" body="Per-event and semester-wide reports open cleanly in Excel and Sheets." />
          <Feature icon={ShieldCheck} title="Officers & owners" body="Assign co-hosts, transfer ownership, protect the roster." />
          <Feature icon={WifiOff} title="Offline resilience" body="Drafts persist through dead Wi-Fi. Members finish check-in when reconnected." />
          <Feature icon={Clock3} title="Live ops view" body="Watch attendance climb in real time. Close windows early with one tap." />
          <Feature icon={Sparkles} title="Templates" body="Save any event as a template. Duplicate next week's meeting in one click." />
          <Feature icon={Smartphone} title="Mobile-first PWA" body="Feels like a native app. Add to home screen. No App Store required." />
        </div>
        <div className="mt-6">
          <Button asChild variant="ghost" className="rounded-full">
            <Link to="/attendance-reports">
              See reports &amp; exports <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </Section>

      <FaqBlock items={FAQS} />

      {/* FINAL CTA */}
      <Section as="section" className="py-20 text-center">
        <h2 className="mx-auto max-w-3xl font-display text-[32px] font-extrabold tracking-tight sm:text-[44px]">
          Take attendance in seconds. Free forever for your first club.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-[16px] text-muted-foreground">
          Create your account, spin up a club, and run your next meeting today.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild size="xl" className="rounded-full">
            <Link to="/sign-up">Start free <ArrowRight className="ml-1 h-4 w-4" /></Link>
          </Button>
          <Button asChild size="xl" variant="ghost" className="rounded-full">
            <Link to="/sign-in">I already have an account</Link>
          </Button>
        </div>
      </Section>
    </MarketingShell>
  );
}

function HeroCard() {
  return (
    <div className="relative mx-auto w-full max-w-md">
      <div className="blur-orb-blue -left-6 -top-8 h-40 w-40" />
      <div className="blur-orb-gold -bottom-8 -right-4 h-40 w-40" />
      <div className="relative overflow-hidden rounded-[2rem] border border-border/60 bg-gradient-hero p-6 text-white shadow-[0_30px_80px_-30px_rgba(11,31,68,0.55)]">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/80">Live event</p>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" /> Open
          </span>
        </div>
        <p className="mt-3 font-display text-[22px] font-extrabold leading-tight">Weekly Chapter Meeting</p>
        <p className="mt-1 text-[13px] text-white/85">Alpha Kappa Society · Tonight · 7:00 PM</p>

        <div className="mt-6 flex items-center gap-4 rounded-2xl bg-white/10 p-4 backdrop-blur">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-white p-2">
            <QrCode className="h-full w-full text-[#0B1F44]" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-white/70">Scan to check in</p>
            <p className="mt-1 font-display text-[17px] font-extrabold">attendance-hq.com/e/aks</p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-3 text-center">
          <Stat label="Head count" value="52" />
          <Stat label="Showed up" value="47" />
          <Stat label="Show rate" value="90%" />
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/10 py-3">
      <p className="font-display text-[22px] font-extrabold leading-none">{value}</p>
      <p className="mt-1 text-[10.5px] font-semibold uppercase tracking-wider text-white/70">{label}</p>
    </div>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">{children}</p>;
}

function Step({ n, icon: Icon, title, body }: { n: number; icon: React.ComponentType<{ className?: string }>; title: string; body: string }) {
  return (
    <div className="relative rounded-3xl border border-border/70 bg-card p-6">
      <span className="absolute -top-3 left-6 inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary font-display text-[13px] font-bold text-primary-foreground">{n}</span>
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="mt-4 font-display text-[18px] font-bold text-foreground">{title}</h3>
      <p className="mt-2 text-[14.5px] leading-6 text-muted-foreground">{body}</p>
    </div>
  );
}

function CompareRow({
  method,
  speed,
  report,
  reportText,
  remote,
  remoteText,
  cost,
  highlight = false,
}: {
  method: string;
  speed: string;
  report?: boolean;
  reportText: string;
  remote?: boolean;
  remoteText: string;
  cost: string;
  highlight?: boolean;
}) {
  return (
    <tr className={highlight ? "bg-primary/5" : undefined}>
      <th scope="row" className={`px-5 py-4 text-left font-display text-[14.5px] font-bold ${highlight ? "text-primary" : "text-foreground"}`}>
        {method}
      </th>
      <td className="px-5 py-4 text-muted-foreground">{speed}</td>
      <td className="px-5 py-4">
        <Verdict ok={Boolean(report)} text={reportText} />
      </td>
      <td className="px-5 py-4">
        <Verdict ok={Boolean(remote)} text={remoteText} />
      </td>
      <td className="px-5 py-4 text-muted-foreground">{cost}</td>
    </tr>
  );
}

function Verdict({ ok, text }: { ok: boolean; text: string }) {
  return (
    <span className="flex items-start gap-2 text-muted-foreground">
      {ok ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-label="Yes" />
      ) : (
        <X className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-label="No" />
      )}
      <span>{text}</span>
    </span>
  );
}

function CapabilityCard({
  to,
  icon: Icon,
  title,
  body,
}: {
  to: MarketingPath;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
}) {
  return (
    <Link
      to={to}
      className="group rounded-2xl border border-border/70 bg-card p-5 transition-shadow hover:shadow-[0_20px_50px_-25px_rgba(37,99,235,0.35)]"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-[18px] w-[18px]" />
      </div>
      <p className="mt-3 font-display text-[15.5px] font-bold text-foreground">{title}</p>
      <p className="mt-1 text-[13.5px] leading-6 text-muted-foreground">{body}</p>
      <span className="mt-3 inline-flex items-center gap-1 text-[12.5px] font-semibold text-primary">
        Learn more <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}

function VerticalCard({
  to,
  icon: Icon,
  title,
  body,
}: {
  to: MarketingPath;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
}) {
  return (
    <Link
      to={to}
      className="group relative flex flex-col rounded-3xl border border-border/70 bg-card p-6 transition-shadow hover:shadow-[0_20px_50px_-25px_rgba(37,99,235,0.35)]"
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="mt-4 font-display text-[18px] font-bold text-foreground">{title}</h3>
      <p className="mt-2 flex-1 text-[14px] leading-6 text-muted-foreground">{body}</p>
      <span className="mt-4 inline-flex items-center gap-1 text-[13px] font-semibold text-primary">
        Learn more <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}

function Feature({ icon: Icon, title, body }: { icon: React.ComponentType<{ className?: string }>; title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-5">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-[18px] w-[18px]" />
      </div>
      <p className="mt-3 font-display text-[15.5px] font-bold text-foreground">{title}</p>
      <p className="mt-1 text-[13.5px] leading-6 text-muted-foreground">{body}</p>
    </div>
  );
}
