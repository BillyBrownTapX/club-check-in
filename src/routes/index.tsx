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
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] sm:px-6 lg:px-8">
        <header className="flex items-center justify-between py-4">
          <AttendanceLogo />
          <Button asChild className="rounded-2xl px-5 shadow-[0_18px_36px_-22px_color-mix(in_oklab,var(--color-primary)_58%,transparent)]">
            <Link to="/sign-in">Sign in</Link>
          </Button>
        </header>
        <main className="flex flex-1 flex-col justify-center py-10">
          <div className="max-w-3xl rounded-[2.2rem] border border-border/90 bg-card/95 px-6 py-8 shadow-[0_28px_72px_-40px_color-mix(in_oklab,var(--color-primary)_46%,transparent)] backdrop-blur">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Enterprise mobile attendance</p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">Mobile QR operations for serious club teams.</h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">Run check-in, monitor live attendance, and manage every event from a polished mobile workspace built for high-trust campus operations.</p>
          </div>
          <div className="mt-10">
            <LandingHighlights />
          </div>
        </main>
      </div>
    </div>
  );
}
