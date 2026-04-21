import { createFileRoute } from "@tanstack/react-router";
import { AttendanceLogo, LandingHighlights } from "@/components/attendance-hq/primitives";

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
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-4 py-8 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between py-4">
          <AttendanceLogo />
        </header>
        <main className="flex flex-1 flex-col justify-center py-12">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Mobile-first attendance</p>
            <h1 className="mt-4 text-5xl font-semibold tracking-tight text-foreground">QR check-in built for club events.</h1>
            <p className="mt-5 text-lg text-muted-foreground">Attendance HQ gives students a clean phone-first check-in flow and helps club officers keep attendance organized.</p>
          </div>
          <div className="mt-10">
            <LandingHighlights />
          </div>
        </main>
      </div>
    </div>
  );
}
