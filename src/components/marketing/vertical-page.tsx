import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FaqBlock, Section, type Faq } from "@/components/marketing/marketing-shell";

export type VerticalPageProps = {
  eyebrow: string;
  h1: ReactNode;
  intro: string;
  /** GEO answer block — one paragraph, 40-60 words. */
  tldr: string;
  steps: { title: string; body: string }[];
  features: { icon: React.ComponentType<{ className?: string }>; title: string; body: string }[];
  scenarios: { title: string; body: string }[];
  faqs: Faq[];
  siblingLinks: {
    to:
      | "/qr-code-attendance"
      | "/club-attendance-tracker"
      | "/greek-life-attendance"
      | "/church-attendance-app"
      | "/vs-google-forms"
      | "/pre-event-headcount"
      | "/attendance-reports"
      | "/club-officer-roles";
    label: string;
    hint: string;
  }[];
};

export function VerticalPage(p: VerticalPageProps) {
  return (
    <>
      {/* HERO */}
      <Section as="section" className="pt-14 pb-12 sm:pt-20">
        <span className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11.5px] font-semibold uppercase tracking-wider text-primary">
          {p.eyebrow}
        </span>
        <h1 className="mt-4 max-w-3xl font-display text-[36px] font-extrabold leading-[1.05] tracking-tight text-foreground sm:text-[52px]">
          {p.h1}
        </h1>
        <p className="mt-5 max-w-2xl text-[17px] leading-7 text-muted-foreground">{p.intro}</p>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <Button asChild size="xl" className="rounded-full">
            <Link to="/sign-up">Start free <ArrowRight className="ml-1 h-4 w-4" /></Link>
          </Button>
          <Button asChild size="xl" variant="outline" className="rounded-full">
            <Link to="/">See the app</Link>
          </Button>
        </div>
      </Section>

      {/* TL;DR */}
      <Section as="section" className="pb-4">
        <div className="rounded-3xl border border-border/70 bg-card p-6 sm:p-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">The short answer</p>
          <p className="mt-3 text-[17.5px] leading-8 text-foreground sm:text-[19px]">{p.tldr}</p>
        </div>
      </Section>

      {/* HOW */}
      <Section as="section" className="py-16">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">How it works</p>
        <h2 className="mt-2 max-w-3xl font-display text-[30px] font-extrabold tracking-tight sm:text-[38px]">Three steps, every meeting.</h2>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {p.steps.map((s, i) => (
            <div key={s.title} className="relative rounded-3xl border border-border/70 bg-card p-6">
              <span className="absolute -top-3 left-6 inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary font-display text-[13px] font-bold text-primary-foreground">{i + 1}</span>
              <h3 className="mt-1 font-display text-[18px] font-bold text-foreground">{s.title}</h3>
              <p className="mt-2 text-[14.5px] leading-6 text-muted-foreground">{s.body}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* FEATURES */}
      <Section as="section" className="py-16">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">What you get</p>
        <h2 className="mt-2 max-w-3xl font-display text-[30px] font-extrabold tracking-tight sm:text-[38px]">Tuned for this exact job.</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {p.features.map((f) => (
            <div key={f.title} className="rounded-2xl border border-border/70 bg-card p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <f.icon className="h-[18px] w-[18px]" />
              </div>
              <p className="mt-3 font-display text-[15.5px] font-bold text-foreground">{f.title}</p>
              <p className="mt-1 text-[13.5px] leading-6 text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* SCENARIOS */}
      <Section as="section" className="py-16">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">Real scenarios</p>
        <h2 className="mt-2 max-w-3xl font-display text-[30px] font-extrabold tracking-tight sm:text-[38px]">Built for the way you actually work.</h2>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {p.scenarios.map((s) => (
            <article key={s.title} className="rounded-3xl border border-border/70 bg-card p-6">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              <h3 className="mt-3 font-display text-[17px] font-bold text-foreground">{s.title}</h3>
              <p className="mt-2 text-[14px] leading-6 text-muted-foreground">{s.body}</p>
            </article>
          ))}
        </div>
      </Section>

      <FaqBlock items={p.faqs} />

      {/* SIBLING LINKS */}
      <Section as="section" className="py-16">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">Explore more</p>
        <h2 className="mt-2 font-display text-[26px] font-extrabold tracking-tight sm:text-[32px]">Also with Attendance-HQ</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {p.siblingLinks.map((s) => (
            <Link
              key={s.to}
              to={s.to}
              className="group flex items-center justify-between gap-4 rounded-2xl border border-border/70 bg-card p-5 transition-shadow hover:shadow-[0_20px_50px_-25px_rgba(37,99,235,0.35)]"
            >
              <div>
                <p className="font-display text-[15.5px] font-bold text-foreground">{s.label}</p>
                <p className="mt-0.5 text-[13px] text-muted-foreground">{s.hint}</p>
              </div>
              <ArrowRight className="h-4 w-4 text-primary transition-transform group-hover:translate-x-0.5" />
            </Link>
          ))}
        </div>
      </Section>

      {/* FINAL CTA */}
      <Section as="section" className="py-20 text-center">
        <h2 className="mx-auto max-w-2xl font-display text-[30px] font-extrabold tracking-tight sm:text-[40px]">
          Ready to make attendance the easiest thing you do all week?
        </h2>
        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild size="xl" className="rounded-full">
            <Link to="/sign-up">Start free <ArrowRight className="ml-1 h-4 w-4" /></Link>
          </Button>
          <Button asChild size="xl" variant="ghost" className="rounded-full">
            <Link to="/sign-in">Sign in</Link>
          </Button>
        </div>
      </Section>
    </>
  );
}
