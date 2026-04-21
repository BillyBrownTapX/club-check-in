import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { Activity, CalendarRange, Home, Settings as SettingsIcon, Users, Bell, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAttendanceAuth } from "@/components/attendance-hq/auth-provider";
import { cn } from "@/lib/utils";

const tabs = [
  { to: "/home", label: "Home", icon: Home, match: (p: string) => p === "/home" || p === "/" },
  { to: "/clubs", label: "Clubs", icon: Users, match: (p: string) => p.startsWith("/clubs") },
  { to: "/events", label: "Events", icon: CalendarRange, match: (p: string) => p.startsWith("/events") },
  { to: "/live", label: "Live", icon: Activity, match: (p: string) => p === "/live" },
  { to: "/settings", label: "Settings", icon: SettingsIcon, match: (p: string) => p === "/settings" },
];

export function HostAppShell({
  children,
  hideTabBar = false,
}: {
  children: React.ReactNode;
  hideTabBar?: boolean;
}) {
  const { pathname } = useLocation();

  return (
    <div className="min-h-screen bg-transparent">
      <main className={cn(
        "mx-auto w-full max-w-[480px] px-4 pt-safe-1 sm:max-w-[520px] sm:px-5",
        hideTabBar ? "pb-safe-1" : "pb-tabbar",
      )}>
        {children}
      </main>
      {hideTabBar ? null : <BottomTabBar pathname={pathname} />}
    </div>
  );
}

function BottomTabBar({ pathname }: { pathname: string }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.6rem,env(safe-area-inset-bottom))] pt-2 pointer-events-none">
      <div className="mx-auto max-w-[420px] pointer-events-auto">
        <div className="ios-tabbar grid grid-cols-5 gap-1 rounded-[1.6rem] p-1.5">
          {tabs.map((tab) => {
            const active = tab.match(pathname);
            const Icon = tab.icon;
            return (
              <Link
                key={tab.to}
                to={tab.to as never}
                style={{ touchAction: "manipulation" }}
                className={cn(
                  "ios-press flex flex-col items-center justify-center gap-0.5 rounded-[1.2rem] py-2 transition-colors",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className={cn("h-[22px] w-[22px]", active ? "stroke-[2.4]" : "stroke-[1.8]")} />
                <span className={cn("text-[10.5px] font-semibold leading-none", active ? "text-primary" : "text-muted-foreground")}>
                  {tab.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

/* Top bar trailing actions used on the Home screen */
export function HomeTopActions() {
  const navigate = useNavigate();
  const { signOut } = useAttendanceAuth();
  return (
    <div className="flex items-center gap-2">
      <Button asChild variant="tonal" size="icon" className="rounded-full" aria-label="Notifications">
        <Link to="/notifications"><Bell className="h-[18px] w-[18px]" /></Link>
      </Button>
      <Button
        variant="tonal"
        size="icon"
        className="rounded-full"
        aria-label="Sign out"
        onClick={async () => { await signOut(); navigate({ to: "/" }); }}
      >
        <LogOut className="h-[18px] w-[18px]" />
      </Button>
    </div>
  );
}
