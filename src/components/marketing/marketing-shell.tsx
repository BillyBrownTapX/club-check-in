import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/attendance-hq/ios";

const CANONICAL_ORIGIN = "https://attendance-hq.com";

export const SITE_ORIGIN = CANONICAL_ORIGIN;

export function absoluteUrl(path: string): string {
  return `${CANONICAL_ORIGIN}${path.startsWith("/") ? path : `/${path}`}`;
}

const NAV: { label: string; to: string }[] = [
  { label: "QR check-in", to: "/qr-code-attendance" },
  { label: "Head count", to: "/pre-event-headcount" },
  { label: "Reports", to: "/attendance-reports" },
  { label: "For clubs", to: "/club-attendance-tracker" },
  { label: "Greek life", to: "/greek-life-attendance" },
  { label: "Churches", to: "/church-attendance-app" },
  { label: "vs Forms", to: "/vs-google-forms" },
];

export function MarketingShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <MarketingHeader />
      <div className="min-h-[70vh]">{children}</div>
      <MarketingFooter />
    </div>
  );
}

function MarketingHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link to="/" aria-label="Attendance-HQ home" className="flex items-center gap-2">
          <BrandMark size="md" />
        </Link>
        <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="rounded-full px-3 py-1.5 text-[13.5px] font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              activeProps={{ className: "rounded-full px-3 py-1.5 text-[13.5px] font-semibold text-primary bg-primary/10" }}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link to="/sign-in">Sign in</Link>
          </Button>
          <Button asChild size="sm" className="rounded-full">
            <Link to="/sign-up">Get started</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

function MarketingFooter() {
  return (
    <footer className="border-t border-border/60 bg-secondary/40">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-4">
        <div>
          <BrandMark size="md" />
          <p className="mt-3 max-w-sm text-[14px] leading-6 text-muted-foreground">
            Attendance-HQ is the QR-code attendance app for college clubs, Greek chapters, campus departments,
            churches, and community groups. Free to start. FERPA-aware. Built mobile-first.
          </p>
        </div>
        <nav aria-label="Product">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Product</p>
          <ul className="mt-3 space-y-2 text-[14px]">
            <li><Link to="/qr-code-attendance" className="text-foreground hover:text-primary">QR code attendance</Link></li>
            <li><Link to="/pre-event-headcount" className="text-foreground hover:text-primary">Pre-event head count</Link></li>
            <li><Link to="/attendance-reports" className="text-foreground hover:text-primary">Attendance reports &amp; CSV</Link></li>
            <li><Link to="/club-officer-roles" className="text-foreground hover:text-primary">Officers &amp; roster privacy</Link></li>
            <li><Link to="/vs-google-forms" className="text-foreground hover:text-primary">vs Google Forms</Link></li>
          </ul>
        </nav>
        <nav aria-label="Solutions">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Solutions</p>
          <ul className="mt-3 space-y-2 text-[14px]">
            <li><Link to="/club-attendance-tracker" className="text-foreground hover:text-primary">College clubs</Link></li>
            <li><Link to="/greek-life-attendance" className="text-foreground hover:text-primary">Fraternities &amp; sororities</Link></li>
            <li><Link to="/church-attendance-app" className="text-foreground hover:text-primary">Churches &amp; small groups</Link></li>
            <li><Link to="/church-attendance-app" className="text-foreground hover:text-primary">Nonprofits &amp; community orgs</Link></li>
            <li><Link to="/campus-department-attendance" className="text-foreground hover:text-primary">Campus departments</Link></li>
          </ul>
        </nav>
        <nav aria-label="Company">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Company</p>
          <ul className="mt-3 space-y-2 text-[14px]">
            <li><Link to="/sign-in" className="text-foreground hover:text-primary">Host sign in</Link></li>
            <li><Link to="/sign-up" className="text-foreground hover:text-primary">Create an account</Link></li>
            <li><Link to="/privacy" className="text-foreground hover:text-primary">Privacy</Link></li>
            <li><Link to="/terms" className="text-foreground hover:text-primary">Terms</Link></li>
          </ul>
        </nav>
      </div>

      <div className="border-t border-border/60">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-start justify-between gap-2 px-4 py-6 text-[12.5px] text-muted-foreground sm:flex-row sm:items-center sm:px-6">
          <p>© {new Date().getFullYear()} Attendance-HQ. All rights reserved.</p>
          <p>Made for hosts who care about their people.</p>
        </div>
      </div>
    </footer>
  );
}

export function Section({
  children,
  className = "",
  as: Tag = "section",
  id,
  aria,
}: {
  children: ReactNode;
  className?: string;
  as?: "section" | "article" | "div";
  id?: string;
  aria?: string;
}) {
  return (
    <Tag id={id} aria-label={aria} className={`mx-auto w-full max-w-6xl px-4 sm:px-6 ${className}`}>
      {children}
    </Tag>
  );
}

export type Faq = { q: string; a: string };

export function FaqBlock({ items, heading = "Frequently asked questions" }: { items: Faq[]; heading?: string }) {
  return (
    <Section as="section" className="py-16">
      <h2 className="font-display text-[28px] font-extrabold tracking-tight text-foreground sm:text-[34px]">{heading}</h2>
      <div className="mt-8 divide-y divide-border/70 rounded-3xl border border-border/70 bg-card">
        {items.map((item) => (
          <details key={item.q} className="group px-5 py-5 open:bg-secondary/40 sm:px-7">
            <summary className="flex cursor-pointer list-none items-start justify-between gap-4 text-[15.5px] font-semibold text-foreground marker:hidden">
              <span>{item.q}</span>
              <span aria-hidden className="mt-1 h-5 w-5 shrink-0 rounded-full border border-border text-center text-[13px] font-bold leading-[18px] text-primary group-open:rotate-45 transition-transform">+</span>
            </summary>
            <p className="mt-3 max-w-3xl text-[14.5px] leading-7 text-muted-foreground">{item.a}</p>
          </details>
        ))}
      </div>
    </Section>
  );
}

export function faqSchema(items: Faq[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}

export function breadcrumbSchema(crumbs: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: absoluteUrl(c.path),
    })),
  };
}

export function softwareAppSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Attendance-HQ",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web, iOS, Android",
    url: CANONICAL_ORIGIN,
    description: "QR code attendance app for college clubs, Greek life, campus departments, churches, and community organizations.",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    publisher: { "@type": "Organization", name: "Attendance-HQ", url: CANONICAL_ORIGIN },
  };
}

export function howToSchema({
  name,
  description,
  steps,
}: {
  name: string;
  description: string;
  steps: { name: string; text: string }[];
}) {
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name,
    description,
    totalTime: "PT1M",
    step: steps.map((s, i) => ({
      "@type": "HowToStep",
      position: i + 1,
      name: s.name,
      text: s.text,
    })),
  };
}



export function buildPageMeta({
  title,
  description,
  path,
  image,
  type = "website",
}: {
  title: string;
  description: string;
  path: string;
  image?: string;
  type?: "website" | "article";
}) {
  const url = absoluteUrl(path);
  const meta: Array<Record<string, string>> = [
    { title },
    { name: "description", content: description },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:type", content: type },
    { property: "og:url", content: url },
    { property: "og:site_name", content: "Attendance-HQ" },
    { name: "twitter:card", content: image ? "summary_large_image" : "summary" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
  ];
  if (image) {
    meta.push({ property: "og:image", content: image });
    meta.push({ name: "twitter:image", content: image });
  }
  const links = [{ rel: "canonical", href: url }];
  return { meta, links };
}
