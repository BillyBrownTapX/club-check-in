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
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] sm:px-6 lg:px-8">
        <header className="flex items-center justify-between py-4">
          <AttendanceLogo />
          <Button asChild className="rounded-2xl px-5">
            <Link to="/sign-in">Sign in</Link>
          </Button>
        </header>
        <main className="flex flex-1 flex-col justify-center py-10">
          <div className="max-w-2xl rounded-[2rem] border border-border/70 bg-card/90 px-6 py-8 shadow-[0_20px_48px_-28px_color-mix(in_oklab,var(--color-primary)_42%,transparent)] backdrop-blur">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Mobile-first attendance</p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">QR check-in built for club events.</h1>
            <p className="mt-5 text-base leading-7 text-muted-foreground sm:text-lg">Attendance HQ gives students a clean phone-first check-in flow and helps club officers keep attendance organized.</p>
          </div>
          <div className="mt-10">
            <LandingHighlights />
          </div>
        </main>
      </div>
    </div>
  );
}
