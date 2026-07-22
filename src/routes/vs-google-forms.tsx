import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowRight, Check, Minus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  FaqBlock,
  MarketingShell,
  Section,
  breadcrumbSchema,
  buildPageMeta,
  faqSchema,
} from "@/components/marketing/marketing-shell";

const OG_IMAGE = "https://attendance-hq.com/__l5e/assets-v1/c341e4a9-19bb-43c6-86d2-488104f847ef/og-attendance-hq.jpg";

const FAQS = [
  { q: "What is the best alternative to Google Forms for taking attendance?", a: "Attendance-HQ is a purpose-built alternative. Google Forms was designed for surveys — you have to manually match emails to a roster, there's no live view, no officer permissions, and no semester report. Attendance-HQ solves all four out of the box." },
  { q: "Why not just use a Google Form for attendance?", a: "A Google Form captures whatever a respondent types, has no duplicate prevention, no email-domain gating, no live roster, and produces a per-event sheet you must manually merge for a semester report. It works — until it doesn't." },
  { q: "Can I migrate from Google Forms to Attendance-HQ?", a: "Yes. Create your club, seed a weekly template, and start using Attendance-HQ for the next meeting. If you want to preserve history, import past attendance from your Google Sheet manually — the CSV format is intentionally simple." },
  { q: "Is it really free?", a: "Yes. The first club is free forever with unlimited events and unlimited members. No credit card required." },
  { q: "How does it compare to paper sign-in sheets?", a: "Paper sign-in sheets have zero enforcement (anyone can sign anyone's name), get lost, and turn into a spreadsheet exercise later. QR check-in from the member's own phone eliminates all three." },
  { q: "How does it compare to a spreadsheet an officer maintains?", a: "It replaces it. Attendance-HQ writes the exact same data — live — while the meeting is happening. The officer keeps their evening back." },
];

type Row = {
  feature: string;
  hq: "yes" | "no" | "partial";
  forms: "yes" | "no" | "partial";
  paper: "yes" | "no" | "partial";
  sheet: "yes" | "no" | "partial";
};

const ROWS: Row[] = [
  { feature: "Purpose-built for attendance", hq: "yes", forms: "no", paper: "no", sheet: "no" },
  { feature: "QR check-in from member's own phone", hq: "yes", forms: "partial", paper: "no", sheet: "no" },
  { feature: "Live roster during the meeting", hq: "yes", forms: "no", paper: "no", sheet: "partial" },
  { feature: "Timestamped, defensible records", hq: "yes", forms: "partial", paper: "no", sheet: "no" },
  { feature: "Email-domain gating (only your campus)", hq: "yes", forms: "partial", paper: "no", sheet: "no" },
  { feature: "Offline-tolerant on flaky Wi-Fi", hq: "yes", forms: "no", paper: "yes", sheet: "no" },
  { feature: "Officer / co-host permissions", hq: "yes", forms: "no", paper: "no", sheet: "partial" },
  { feature: "Reusable weekly-meeting templates", hq: "yes", forms: "no", paper: "no", sheet: "partial" },
  { feature: "Semester × student attendance matrix", hq: "yes", forms: "no", paper: "no", sheet: "partial" },
  { feature: "One-tap CSV export", hq: "yes", forms: "yes", paper: "no", sheet: "yes" },
  { feature: "FERPA-aware retention & scoping", hq: "yes", forms: "partial", paper: "no", sheet: "no" },
  { feature: "Free for your first group", hq: "yes", forms: "yes", paper: "yes", sheet: "yes" },
];

const CellIcon = ({ v }: { v: "yes" | "no" | "partial" }) =>
  v === "yes" ? (
    <Check className="mx-auto h-5 w-5 text-primary" aria-label="Yes" />
  ) : v === "no" ? (
    <X className="mx-auto h-5 w-5 text-muted-foreground/50" aria-label="No" />
  ) : (
    <Minus className="mx-auto h-5 w-5 text-muted-foreground" aria-label="Partial" />
  );

export const Route = createFileRoute("/vs-google-forms")({
  head: () => {
    const meta = buildPageMeta({
      title: "Attendance-HQ vs Google Forms — Best Attendance App Alternative",
      description:
        "Google Forms wasn't built for attendance. Compare Attendance-HQ, Google Forms, paper sign-in, and spreadsheets — feature by feature — plus a migration guide.",
      path: "/vs-google-forms",
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
              { name: "vs Google Forms", path: "/vs-google-forms" },
            ]),
          ),
        },
      ],
    };
  },
  component: ComparePage,
});

function ComparePage() {
  return (
    <MarketingShell>
      <Section as="section" className="pt-14 pb-8 sm:pt-20">
        <span className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11.5px] font-semibold uppercase tracking-wider text-primary">
          Comparison
        </span>
        <h1 className="mt-4 max-w-4xl font-display text-[36px] font-extrabold leading-[1.05] tracking-tight text-foreground sm:text-[54px]">
          Attendance-HQ vs <span className="text-primary">Google Forms, paper sign-in, and spreadsheets.</span>
        </h1>
        <p className="mt-5 max-w-2xl text-[17px] leading-7 text-muted-foreground">
          Google Forms was built for surveys. Paper sheets get lost. Spreadsheets are
          maintained by whichever officer forgot to say no. Here's how the four options
          actually stack up.
        </p>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <Button asChild size="xl" className="rounded-full">
            <Link to="/sign-up">Start free <ArrowRight className="ml-1 h-4 w-4" /></Link>
          </Button>
          <Button asChild size="xl" variant="outline" className="rounded-full">
            <Link to="/qr-code-attendance">How QR check-in works</Link>
          </Button>
        </div>
      </Section>

      <Section as="section" className="pb-4">
        <div className="rounded-3xl border border-border/70 bg-card p-6 sm:p-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">The short answer</p>
          <p className="mt-3 text-[17.5px] leading-8 text-foreground sm:text-[19px]">
            <strong>Attendance-HQ</strong> is the best alternative to Google Forms for attendance because it's
            purpose-built for the job: QR check-in from the member's own phone, live roster during the meeting,
            officer permissions, email-domain enforcement, offline resilience, reusable templates, and a
            semester-wide attendance matrix — none of which Google Forms provides out of the box.
          </p>
        </div>
      </Section>

      <Section as="section" className="py-16">
        <div className="overflow-hidden rounded-3xl border border-border/70 bg-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-[14px]">
              <thead className="bg-secondary/60">
                <tr>
                  <th className="px-5 py-4 font-display text-[13px] font-semibold uppercase tracking-wider text-muted-foreground">Feature</th>
                  <th className="px-4 py-4 text-center font-display text-[13px] font-semibold text-primary">Attendance-HQ</th>
                  <th className="px-4 py-4 text-center font-display text-[13px] font-semibold text-muted-foreground">Google Forms</th>
                  <th className="px-4 py-4 text-center font-display text-[13px] font-semibold text-muted-foreground">Paper sign-in</th>
                  <th className="px-4 py-4 text-center font-display text-[13px] font-semibold text-muted-foreground">Spreadsheet</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {ROWS.map((r) => (
                  <tr key={r.feature}>
                    <td className="px-5 py-3.5 font-medium text-foreground">{r.feature}</td>
                    <td className="px-4 py-3.5 text-center"><CellIcon v={r.hq} /></td>
                    <td className="px-4 py-3.5 text-center"><CellIcon v={r.forms} /></td>
                    <td className="px-4 py-3.5 text-center"><CellIcon v={r.paper} /></td>
                    <td className="px-4 py-3.5 text-center"><CellIcon v={r.sheet} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="border-t border-border/60 px-5 py-3 text-[12px] text-muted-foreground">
            <Check className="mr-1 inline h-3.5 w-3.5 text-primary" /> Yes · <Minus className="mx-1 inline h-3.5 w-3.5" /> Partial / DIY · <X className="mx-1 inline h-3.5 w-3.5" /> No
          </p>
        </div>
      </Section>

      <Section as="section" className="py-16">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">Migration guide</p>
        <h2 className="mt-2 font-display text-[30px] font-extrabold tracking-tight sm:text-[38px]">Switch in one meeting.</h2>
        <ol className="mt-8 grid gap-5 md:grid-cols-3">
          {[
            { n: 1, title: "Create your club or group", body: "Takes 30 seconds. Tie it to your university if applicable. Invite co-officers by email." },
            { n: 2, title: "Seed a template", body: "The weekly-meeting template is pre-created. Adjust the check-in window to match your meeting time." },
            { n: 3, title: "Run next week with QR", body: "Project the QR at the top of the meeting. Members scan. Delete the old Google Form after." },
          ].map((s) => (
            <li key={s.n} className="relative rounded-3xl border border-border/70 bg-card p-6">
              <span className="absolute -top-3 left-6 inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary font-display text-[13px] font-bold text-primary-foreground">{s.n}</span>
              <h3 className="mt-1 font-display text-[18px] font-bold">{s.title}</h3>
              <p className="mt-2 text-[14.5px] leading-6 text-muted-foreground">{s.body}</p>
            </li>
          ))}
        </ol>
      </Section>

      <FaqBlock items={FAQS} />

      <Section as="section" className="py-20 text-center">
        <h2 className="mx-auto max-w-2xl font-display text-[30px] font-extrabold tracking-tight sm:text-[42px]">
          Retire the Google Form. Free forever for your first group.
        </h2>
        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild size="xl" className="rounded-full">
            <Link to="/sign-up">Start free <ArrowRight className="ml-1 h-4 w-4" /></Link>
          </Button>
          <Button asChild size="xl" variant="ghost" className="rounded-full">
            <Link to="/">Back to home</Link>
          </Button>
        </div>
      </Section>
    </MarketingShell>
  );
}
