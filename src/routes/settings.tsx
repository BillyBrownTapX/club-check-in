import { useNavigate, createFileRoute, Link } from "@tanstack/react-router";
import { Bell, ChevronRight, Lock, LogOut, Mail, ShieldCheck, User as UserIcon } from "lucide-react";
import { useAttendanceAuth } from "@/components/attendance-hq/auth-provider";
import { HostAppShell } from "@/components/attendance-hq/host-shell";
import { useRequireHostRedirect } from "@/components/attendance-hq/host-management";
import { GroupedList, LargeTitleHeader, ListRow, SectionLabel } from "@/components/attendance-hq/ios";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Attendance HQ" },
      { name: "description", content: "Profile, organization, and preferences." },
    ],
  }),
  component: SettingsRoute,
});

function SettingsRoute() {
  const { loading, user } = useRequireHostRedirect();
  const auth = useAttendanceAuth();
  const navigate = useNavigate();

  if (loading || !user) return <HostAppShell><div className="py-16 text-center text-sm text-muted-foreground">Loading…</div></HostAppShell>;

  const meta = (auth.user?.user_metadata ?? {}) as { full_name?: string };
  const fullName = meta.full_name ?? auth.user?.email ?? "Host";
  const initials = fullName.split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();

  return (
    <HostAppShell>
      <LargeTitleHeader title="Settings" subtitle="Profile, organization, and preferences." />

      <div className="ios-card mt-2 flex items-center gap-4 rounded-2xl p-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-brand text-primary-foreground font-display text-[18px] font-extrabold">{initials || "A"}</div>
        <div className="min-w-0 flex-1">
          <p className="font-display text-[17px] font-extrabold text-foreground">{fullName}</p>
          <p className="text-[13px] text-muted-foreground truncate">{auth.user?.email}</p>
        </div>
        <Link to="/clubs" className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-primary"><ChevronRight className="h-4 w-4" /></Link>
      </div>

      <SectionLabel className="mt-6">Workspace</SectionLabel>
      <GroupedList>
        <ListRow icon={UserIcon} label="Clubs" detail="Manage your organizations" to="/clubs" />
        <ListRow icon={ShieldCheck} label="Events" detail="All your events" to="/events" search={{ clubId: "", status: "all", query: "" }} />
      </GroupedList>

      <SectionLabel className="mt-6">Preferences</SectionLabel>
      <GroupedList>
        <ListRow icon={Bell} label="Notifications" detail="Activity and milestones" to="/notifications" />
        <ListRow icon={Mail} label="Email" value={auth.user?.email} chevron={false} />
      </GroupedList>

      <SectionLabel className="mt-6">Security</SectionLabel>
      <GroupedList>
        <ListRow icon={Lock} label="Change password" to="/forgot-password" />
      </GroupedList>

      <SectionLabel className="mt-6">Account</SectionLabel>
      <GroupedList>
        <ListRow
          icon={LogOut}
          iconBg="bg-destructive/10"
          iconColor="text-destructive"
          label="Sign out"
          destructive
          chevron={false}
          onClick={async () => { await auth.signOut(); navigate({ to: "/" }); }}
        />
      </GroupedList>

      <p className="mt-8 px-2 text-center text-[12px] text-muted-foreground">Attendance HQ · v1.0</p>
    </HostAppShell>
  );
}
