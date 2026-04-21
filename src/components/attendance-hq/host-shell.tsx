import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { CalendarRange, LogOut, Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AttendanceLogo } from "@/components/attendance-hq/primitives";
import { useAttendanceAuth } from "@/components/attendance-hq/auth-provider";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/clubs", label: "Clubs", icon: Users },
  { to: "/events", label: "Events", icon: CalendarRange },
];

export function HostAppShell({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAttendanceAuth();
  const currentSection = pathname.startsWith("/events") ? "Events" : pathname.startsWith("/clubs") ? "Clubs" : "Attendance HQ";

  return (
    <div className="min-h-screen bg-transparent">
      <header className="sticky top-0 z-40 px-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-5">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-3 rounded-[1.6rem] border border-border/70 bg-background/88 px-4 py-3 shadow-[0_12px_32px_-20px_color-mix(in_oklab,var(--color-primary)_40%,transparent)] backdrop-blur-xl">
          <AttendanceLogo compact />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Host workspace</p>
            <p className="truncate text-base font-semibold text-foreground">{currentSection}</p>
          </div>
          <nav className="hidden items-center gap-2 md:flex">
            {navItems.map((item) => (
              <Link
                key={item.to}
                to={item.to as never}
                className={cn(
                  "inline-flex h-11 items-center gap-2 rounded-2xl px-4 text-sm font-semibold transition-colors",
                  pathname === item.to ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="h-11 w-11 rounded-2xl border-border/80 md:hidden" asChild>
              <Link to="/events/new" search={{ clubId: "", templateId: "", duplicateFrom: "" }}><Plus className="h-4 w-4" /></Link>
            </Button>
            <Button
              variant="outline"
              className="hidden h-11 rounded-2xl border-border/80 px-4 md:inline-flex"
              onClick={async () => {
                await signOut();
                navigate({ to: "/" });
              }}
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-3 pb-[7.75rem] pt-1 sm:px-5 md:pb-8">{children}</main>
      <Button
        type="button"
        size="icon"
        className="fixed bottom-[calc(5.6rem+env(safe-area-inset-bottom))] right-4 z-40 h-14 w-14 rounded-full shadow-[0_18px_40px_-18px_color-mix(in_oklab,var(--color-primary)_70%,transparent)] md:hidden"
        onClick={() => navigate({ to: "/events/new", search: { clubId: "", templateId: "", duplicateFrom: "" } })}
        aria-label="Create event"
      >
        <Plus className="h-5 w-5" />
      </Button>
      <nav className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.9rem,env(safe-area-inset-bottom))] pt-2 md:hidden">
        <div className="mx-auto grid max-w-md grid-cols-2 gap-2 rounded-[1.8rem] border border-border/70 bg-background/92 p-2 shadow-[0_18px_48px_-20px_color-mix(in_oklab,var(--color-primary)_35%,transparent)] backdrop-blur-xl">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to as never}
              className={cn(
                "flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl px-3 py-2 text-[0.72rem] font-semibold",
                pathname === item.to ? "bg-primary text-primary-foreground" : "text-muted-foreground",
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
