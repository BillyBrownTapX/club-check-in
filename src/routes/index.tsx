import { Link, createFileRoute } from "@tanstack/react-router";
import { CalendarRange, QrCode, Sparkles, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/attendance-hq/ios";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Attendance HQ — QR attendance for college clubs" },
      { name: "description", content: "Run mobile QR check-in for university club events with a polished, iOS-native workflow." },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen">
      <main className="mx-auto flex min-h-screen w-full max-w-[480px] flex-col px-4 pb-safe pt-safe-1 sm:max-w-[520px] sm:px-5">
        <header className="flex items-center justify-between py-3">
          <BrandMark size="sm" />
          <Button asChild variant="tonal" size="sm" className="rounded-full">
            <Link to="/sign-in">Sign in</Link>
          </Button>
        </header>

        {/* Hero */}
        <section className="relative mt-3 overflow-hidden rounded-[2rem] hero-wash p-6 text-white ios-spring-in">
          <div className="blur-orb-white -left-6 -top-6 h-32 w-32 opacity-50" />
          <div className="blur-orb-gold -bottom-10 -right-8 h-36 w-36 opacity-60" />
          <p className="relative text-[11px] font-semibold uppercase tracking-[0.18em] text-white/80">Built for campus events</p>
          <h1 className="relative mt-3 font-display text-[34px] font-extrabold leading-[1.05] tracking-tight">
            A new way to run events.
          </h1>
          <p className="relative mt-3 text-[15px] leading-6 text-white/85">
            Check in students in seconds with a single QR. Manage clubs, events, and live attendance from one beautifully calm workspace.
          </p>
          <div className="relative mt-6 flex flex-col gap-2.5">
            <Button asChild variant="hero" size="xl" className="w-full">
              <Link to="/sign-up">Get started</Link>
            </Button>
            <Button asChild variant="outline" size="xl" className="w-full border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white">
              <Link to="/sign-in">I already have an account</Link>
            </Button>
          </div>
        </section>

        {/* Features */}
        <section className="mt-5 grid grid-cols-2 gap-3">
          <FeatureCard icon={QrCode} title="QR check-in" hint="One scan. Done." />
          <FeatureCard icon={Users} title="Clubs" hint="University-linked" tone="cream" />
          <FeatureCard icon={CalendarRange} title="Events" hint="Plan & launch" tone="cream" />
          <FeatureCard icon={Sparkles} title="Live ops" hint="Real-time roster" />
        </section>

        {/* Bottom flourish */}
        <div className="mt-auto pt-8">
          <p className="px-2 text-center text-[12px] text-muted-foreground">
            Mobile-first. iPhone-native. Built for hosts who care.
          </p>
        </div>
      </main>
    </div>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  hint,
  tone = "default",
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  hint: string;
  tone?: "default" | "cream";
}) {
  return (
    <div className={tone === "cream" ? "rounded-2xl surface-cream p-4" : "ios-card rounded-2xl p-4"}>
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon className="h-[18px] w-[18px]" />
      </div>
      <p className="mt-3 font-display text-[15px] font-bold text-foreground">{title}</p>
      <p className="mt-0.5 text-[12.5px] text-muted-foreground">{hint}</p>
    </div>
  );
}
