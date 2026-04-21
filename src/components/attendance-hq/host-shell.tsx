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

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <AttendanceLogo compact />
          <nav className="hidden items-center gap-2 md:flex">
            {navItems.map((item) => (
              <Link
                key={item.to}
                to={item.to as never}
                className={cn(
                  "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                  pathname === item.to ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="rounded-xl md:hidden" asChild>
              <Link to="/events/new" search={{ clubId: "", templateId: "", duplicateFrom: "" }}><Plus className="h-4 w-4" /></Link>
            </Button>
            <Button
              variant="outline"
              className="rounded-xl"
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
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border/70 bg-background/95 px-2 py-2 backdrop-blur md:hidden">
        <div className="grid grid-cols-2 gap-2">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to as never}
              className={cn(
                "flex flex-col items-center gap-1 rounded-xl px-3 py-2 text-xs font-medium",
                pathname === item.to ? "bg-secondary text-foreground" : "text-muted-foreground",
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
