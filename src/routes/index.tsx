import { Link, createFileRoute } from "@tanstack/react-router";
import { AttendanceLogo, LandingHighlights } from "@/components/attendance-hq/primitives";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Attendance HQ — QR attendance for college clubs" },
      { name: "description", content: "Attendance HQ helps college clubs run fast QR check-ins with a polished mobile student flow." },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen bg-app-shell">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] sm:px-6 lg:px-8">
        <header className="flex items-center justify-between py-4">
          <AttendanceLogo />
          <Button asChild variant="hero" size="lg">
            <Link to="/sign-in">Sign in</Link>
          </Button>
        </header>
        <main className="flex flex-1 flex-col justify-center py-8 sm:py-10">
          <section className="relative overflow-hidden rounded-[2.4rem] hero-wash px-6 py-8 text-white shadow-[0_32px_88px_-44px_color-mix(in_oklab,var(--color-primary)_40%,transparent)] sm:px-8 sm:py-10">
            <div className="blur-orb-white left-2 top-2 h-24 w-24 opacity-40" />
            <div className="blur-orb-blue -bottom-10 right-0 h-36 w-36 opacity-50" />
            <div className="relative max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/80">UNG-ready attendance operations</p>
              <h1 className="mt-4 font-display text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl">Mobile QR check-in built for serious campus events.</h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-white/85 sm:text-lg">Run check-in, monitor live attendance, and manage every event from a faster university-branded workflow designed for repeat student use.</p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Button asChild variant="hero" size="lg"><Link to="/sign-up">Create account</Link></Button>
                <Button asChild variant="outline" size="lg" className="border-white/30 bg-white/10 text-white hover:bg-white/18 hover:text-white"><Link to="/sign-in">Host sign in</Link></Button>
              </div>
            </div>
          </section>
          <section className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-[1.6rem] bg-card px-5 py-5 shadow-[0_18px_44px_-30px_color-mix(in_oklab,var(--color-primary)_18%,transparent)]">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/70">Fast entry</p>
              <p className="mt-2 font-display text-2xl font-extrabold text-foreground">900-first</p>
              <p className="mt-2 text-sm text-muted-foreground">Students move from lookup to confirmation in seconds on repeat visits.</p>
            </div>
            <div className="rounded-[1.6rem] surface-soft px-5 py-5 shadow-[0_18px_44px_-30px_color-mix(in_oklab,var(--color-primary)_14%,transparent)]">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/70">University-linked</p>
              <p className="mt-2 font-display text-2xl font-extrabold text-foreground">Scoped cleanly</p>
              <p className="mt-2 text-sm text-muted-foreground">Club context defines the student universe, not student input.</p>
            </div>
            <div className="rounded-[1.6rem] surface-cream px-5 py-5 shadow-[0_18px_44px_-30px_color-mix(in_oklab,var(--color-ung-gold)_18%,transparent)]">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/70">Ops clarity</p>
              <p className="mt-2 font-display text-2xl font-extrabold text-foreground">Live control</p>
              <p className="mt-2 text-sm text-muted-foreground">Hosts can launch, monitor, export, and correct attendance from one mobile workspace.</p>
            </div>
          </section>
          <div className="mt-8">
            <LandingHighlights />
          </div>
        </main>
      </div>
    </div>
  );
}
