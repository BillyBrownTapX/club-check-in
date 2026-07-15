import { createFileRoute, Link } from "@tanstack/react-router";
import { HostAppShell } from "@/components/attendance-hq/host-shell";
import { useRequireHostRedirect } from "@/components/attendance-hq/host-management";
import { GroupedList, LargeTitleHeader, ListRow, SectionLabel } from "@/components/attendance-hq/ios";
import { ATTENDANCE_RETENTION_DAYS } from "@/lib/attendance-hq";
import {
  CalendarCheck2,
  Clock,
  QrCode,
  UserCheck,
  Timer,
  WifiOff,
  Download,
  ShieldAlert,
} from "lucide-react";

export const Route = createFileRoute("/help")({
  head: () => ({
    meta: [
      { title: "Help — Attendance HQ" },
      { name: "description", content: "Runbook for live check-in." },
      { property: "og:title", content: "Help — Attendance HQ" },
      { property: "og:description", content: "Runbook for live check-in." },
      { name: "twitter:title", content: "Help — Attendance HQ" },
      { name: "twitter:description", content: "Runbook for live check-in." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: HelpRoute,
});

function HelpRoute() {
  const { loading, user } = useRequireHostRedirect();
  if (loading || !user)
    return (
      <HostAppShell>
        <div className="py-16 text-center text-sm text-muted-foreground">Loading…</div>
      </HostAppShell>
    );

  return (
    <HostAppShell>
      <LargeTitleHeader title="Help" subtitle="Runbook for live check-in." />

      <SectionLabel className="mt-6">Before doors open</SectionLabel>
      <GroupedList>
        <ListRow icon={CalendarCheck2} label="Set up the event" chevron={false} />
      </GroupedList>
      <p className="mt-2 px-3 text-[13px] leading-6 text-muted-foreground">
        Create the event, then confirm the check-in window opens a few minutes before your start time and closes shortly
        after the end. Open the event's <strong>Display</strong> page on a laptop or TV so students can scan the QR from
        their seats.
      </p>

      <SectionLabel className="mt-6">Students can't check in yet</SectionLabel>
      <GroupedList>
        <ListRow icon={Clock} label="Check-in window not open" chevron={false} />
      </GroupedList>
      <p className="mt-2 px-3 text-[13px] leading-6 text-muted-foreground">
        The message "Check-in not open yet" or "Check-in closed" means the window is outside the times you set. Edit the
        event and adjust "Check-in opens" / "Check-in closes", or wait for the window to open.
      </p>

      <SectionLabel className="mt-6">QR won't scan or leads to the wrong page</SectionLabel>
      <GroupedList>
        <ListRow icon={QrCode} label="Use Display or Show QR" chevron={false} />
      </GroupedList>
      <p className="mt-2 px-3 text-[13px] leading-6 text-muted-foreground">
        Open the event's <strong>Display</strong> page on a big screen — the QR there is the correct link for this
        event. If a phone camera won't recognize a printed code, ask students to point at the projected Display QR
        instead. Every event has its own QR; older printed codes may point to a different event.
      </p>

      <SectionLabel className="mt-6">"Already checked in"</SectionLabel>
      <GroupedList>
        <ListRow icon={UserCheck} label="They're on the roster" chevron={false} />
      </GroupedList>
      <p className="mt-2 px-3 text-[13px] leading-6 text-muted-foreground">
        This means the student is already recorded for this event. Confirm on the event page — the roster and Live view
        show every check-in with timestamps.
      </p>

      <SectionLabel className="mt-6">"Too many attempts"</SectionLabel>
      <GroupedList>
        <ListRow icon={Timer} label="Shared Wi-Fi rate limit" chevron={false} />
      </GroupedList>
      <p className="mt-2 px-3 text-[13px] leading-6 text-muted-foreground">
        On campus Wi-Fi many phones share one connection, and rapid retries can trip a short cooldown. Ask students to
        wait a moment and tap once — repeatedly tapping "Check In" makes it worse.
      </p>

      <SectionLabel className="mt-6">Dead Wi-Fi</SectionLabel>
      <GroupedList>
        <ListRow icon={WifiOff} label="Switch to cellular" chevron={false} />
      </GroupedList>
      <p className="mt-2 px-3 text-[13px] leading-6 text-muted-foreground">
        If the venue Wi-Fi is down, ask students to turn Wi-Fi off and use cellular data to scan and check in. The
        check-in page keeps their typed name, email, and 900 number saved on their phone — if a submit fails, they can
        switch to cellular and tap <strong>Try again</strong> without retyping. If a specific student can't get on
        either network, use <strong>Manual check-in</strong> from the event page to add them by 900 number.
      </p>

      <SectionLabel className="mt-6">Export attendance</SectionLabel>
      <GroupedList>
        <ListRow icon={Download} label="CSV after the meeting" chevron={false} />
      </GroupedList>
      <p className="mt-2 px-3 text-[13px] leading-6 text-muted-foreground">
        Once the meeting ends, open the event and use <strong>Export CSV</strong>. The file includes each student's
        name, email, 900 number, check-in time, and method — ready for a gradebook or advisor report.
      </p>

      <SectionLabel className="mt-6">Data retention & FERPA</SectionLabel>
      <GroupedList>
        <ListRow icon={ShieldAlert} label="Retention & purge" chevron={false} />
      </GroupedList>
      <p className="mt-2 px-3 text-[13px] leading-6 text-muted-foreground">
        Attendance HQ keeps check-in history for about {ATTENDANCE_RETENTION_DAYS} days (~2 academic
        years) by default. Export the semester report CSV regularly, and only run the club's
        <strong> Delete attendance older than…</strong> control after you've exported. See our{" "}
        <Link to="/privacy" className="font-semibold text-primary underline underline-offset-2">
          privacy policy
        </Link>{" "}
        for the full story; campus policy may require shorter or longer retention — follow yours.
      </p>

      <p className="mt-8 px-2 text-center text-[12px] text-muted-foreground">Attendance HQ · Host runbook</p>
    </HostAppShell>
  );
}
