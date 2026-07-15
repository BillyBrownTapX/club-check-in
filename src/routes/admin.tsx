// Admin console — Overview / Hosts / Clubs / Universities.
//
// Access is client-gated by `getAdminMe`: non-admins get redirected to /home
// before any admin data is fetched. The server enforces admin separately, so
// even if this gate is bypassed the list/mutate fns still return 403.

import * as React from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { BarChart3, Building2, ShieldCheck, Users } from "lucide-react";

import { useAuthorizedQuery, useAuthorizedMutation } from "@/components/attendance-hq/auth-provider";
import { HostAppShell } from "@/components/attendance-hq/host-shell";
import { useRequireHostRedirect, getManagementErrorMessage } from "@/components/attendance-hq/host-management";
import { GroupedList, LargeTitleHeader, ListRow, SectionLabel, SegmentedControl, StatTile } from "@/components/attendance-hq/ios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatTimestamp } from "@/lib/attendance-hq";
import {
  getAdminMe,
  getAdminOverview,
  listAdminHosts,
  setHostDisabled,
  listAdminClubs,
  setClubActive,
  listAdminUniversities,
  upsertAdminUniversity,
  type AdminHostEntry,
  type AdminClubEntry,
  type AdminUniversityEntry,
  type AdminOverview,
} from "@/lib/admin.functions";

type Tab = "overview" | "hosts" | "clubs" | "universities";

const adminKeys = {
  me: ["admin", "me"] as const,
  overview: ["admin", "overview"] as const,
  hosts: (q: string) => ["admin", "hosts", q] as const,
  clubs: (q: string) => ["admin", "clubs", q] as const,
  universities: ["admin", "universities"] as const,
};

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin console — Attendance HQ" },
      { name: "description", content: "Campus staff console for hosts, clubs, and universities." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminRoute,
});

function AdminRoute() {
  const { loading, user } = useRequireHostRedirect();
  const navigate = useNavigate();
  const [tab, setTab] = React.useState<Tab>("overview");

  const meQuery = useAuthorizedQuery<{ isAdmin: boolean }>(adminKeys.me, getAdminMe, undefined, {
    staleTime: 60_000,
  });

  React.useEffect(() => {
    if (meQuery.data && !meQuery.data.isAdmin) {
      navigate({ to: "/home" });
    }
  }, [meQuery.data, navigate]);

  if (loading || !user || meQuery.isLoading) {
    return <HostAppShell><div className="py-16 text-center text-sm text-muted-foreground">Loading…</div></HostAppShell>;
  }
  if (!meQuery.data?.isAdmin) {
    return <HostAppShell><div className="py-16 text-center text-sm text-muted-foreground">Redirecting…</div></HostAppShell>;
  }

  return (
    <HostAppShell layout="ops">
      <LargeTitleHeader title="Admin console" subtitle="Campus staff tools." />

      <div className="mt-2">
        <SegmentedControl
          value={tab}
          onChange={setTab}
          options={[
            { value: "overview", label: "Overview" },
            { value: "hosts", label: "Hosts" },
            { value: "clubs", label: "Clubs" },
            { value: "universities", label: "Universities" },
          ]}
        />
      </div>

      <div className="mt-5">
        {tab === "overview" ? <OverviewPanel /> : null}
        {tab === "hosts" ? <HostsPanel currentUserId={user.id} /> : null}
        {tab === "clubs" ? <ClubsPanel /> : null}
        {tab === "universities" ? <UniversitiesPanel /> : null}
      </div>
    </HostAppShell>
  );
}

// ─── Overview ─────────────────────────────────────────────────────────
function OverviewPanel() {
  const query = useAuthorizedQuery<AdminOverview>(adminKeys.overview, getAdminOverview, undefined, {
    staleTime: 30_000,
  });
  if (query.isLoading) {
    return <div className="ios-card rounded-3xl p-6 text-center text-sm text-muted-foreground">Loading metrics…</div>;
  }
  if (query.error || !query.data) {
    return <div className="ios-card rounded-3xl p-6 text-center text-sm text-destructive">{getManagementErrorMessage(query.error, "Unable to load metrics.")}</div>;
  }
  const d = query.data;
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
      <StatTile label="Hosts" value={d.hosts.total} hint={`${d.hosts.disabled} disabled`} icon={Users} />
      <StatTile label="Clubs" value={d.clubs.total} hint={`${d.clubs.inactive} inactive`} icon={Building2} />
      <StatTile label="Events (7d)" value={d.events.last7Days} tone="blue" icon={BarChart3} />
      <StatTile label="Check-ins (7d)" value={d.checkIns.last7Days} tone="gold" />
      <StatTile label="Check-ins (30d)" value={d.checkIns.last30Days} />
      <StatTile label="Universities" value={d.universities} />
      <StatTile label="Students" value={d.students} tone="success" />
    </div>
  );
}

// ─── Hosts ────────────────────────────────────────────────────────────
function HostsPanel({ currentUserId }: { currentUserId: string }) {
  const [q, setQ] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  React.useEffect(() => {
    const id = setTimeout(() => setDebounced(q.trim()), 250);
    return () => clearTimeout(id);
  }, [q]);

  const query = useAuthorizedQuery<AdminHostEntry[], { q: string }>(
    adminKeys.hosts(debounced),
    listAdminHosts,
    { q: debounced },
    { staleTime: 15_000 },
  );

  const [target, setTarget] = React.useState<AdminHostEntry | null>(null);

  return (
    <div>
      <Input
        placeholder="Search hosts by name or email"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="mb-4"
      />
      {query.isLoading ? (
        <div className="ios-card rounded-2xl p-6 text-center text-sm text-muted-foreground">Loading hosts…</div>
      ) : query.error ? (
        <div className="ios-card rounded-2xl p-6 text-center text-sm text-destructive">{getManagementErrorMessage(query.error, "Unable to load hosts.")}</div>
      ) : (query.data ?? []).length === 0 ? (
        <div className="ios-card rounded-2xl p-6 text-center text-sm text-muted-foreground">No hosts match.</div>
      ) : (
        <GroupedList>
          {(query.data ?? []).map((h) => (
            <ListRow
              key={h.id}
              icon={Users}
              iconBg={h.isDisabled ? "bg-destructive/10" : "bg-primary/10"}
              iconColor={h.isDisabled ? "text-destructive" : "text-primary"}
              label={h.fullName}
              detail={`${h.email} · ${h.clubCount} club${h.clubCount === 1 ? "" : "s"}${h.isDisabled ? " · disabled" : ""}`}
              trailing={
                <Button
                  variant={h.isDisabled ? "outline" : "destructive"}
                  size="sm"
                  onClick={(e) => {
                    e.preventDefault();
                    setTarget(h);
                  }}
                  disabled={h.id === currentUserId}
                >
                  {h.isDisabled ? "Re-enable" : "Disable"}
                </Button>
              }
              chevron={false}
            />
          ))}
        </GroupedList>
      )}
      <HostDisableDialog target={target} onClose={() => setTarget(null)} debouncedQ={debounced} />
    </div>
  );
}

function HostDisableDialog({
  target,
  onClose,
  debouncedQ,
}: {
  target: AdminHostEntry | null;
  onClose: () => void;
  debouncedQ: string;
}) {
  const [reason, setReason] = React.useState("");
  React.useEffect(() => {
    setReason(target?.disabledReason ?? "");
  }, [target]);

  const mutation = useAuthorizedMutation<
    { ok: true },
    { hostId: string; disabled: boolean; reason?: string }
  >(setHostDisabled, {
    invalidate: [adminKeys.hosts(debouncedQ), adminKeys.overview],
    onSuccess: () => {
      toast.success(target?.isDisabled ? "Host re-enabled." : "Host disabled.");
      onClose();
    },
    onError: (err) => toast.error(getManagementErrorMessage(err, "Unable to update host.")),
  });

  const open = !!target;
  const willDisable = !target?.isDisabled;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{willDisable ? "Disable host" : "Re-enable host"}</DialogTitle>
          <DialogDescription>
            {willDisable
              ? `${target?.fullName} won't be able to create or update clubs and events. Live check-in for their existing events keeps working.`
              : `${target?.fullName} will regain host access.`}
          </DialogDescription>
        </DialogHeader>
        {willDisable ? (
          <div className="space-y-2">
            <label className="text-[13px] font-medium text-foreground">Reason (optional, staff-visible)</label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={280}
              rows={3}
              placeholder="e.g. Reported for misuse — pending review."
            />
            <p className="text-[12px] text-muted-foreground">Keep this short. Never include student names, emails, or 900 numbers.</p>
          </div>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            variant={willDisable ? "destructive" : "hero"}
            disabled={mutation.isPending}
            onClick={() => {
              if (!target) return;
              mutation.mutate({
                hostId: target.id,
                disabled: willDisable,
                reason: willDisable ? reason.trim() : "",
              });
            }}
          >
            {mutation.isPending ? "Working…" : willDisable ? "Disable host" : "Re-enable host"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Clubs ────────────────────────────────────────────────────────────
function ClubsPanel() {
  const [q, setQ] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  React.useEffect(() => {
    const id = setTimeout(() => setDebounced(q.trim()), 250);
    return () => clearTimeout(id);
  }, [q]);

  const query = useAuthorizedQuery<AdminClubEntry[], { q: string }>(
    adminKeys.clubs(debounced),
    listAdminClubs,
    { q: debounced },
    { staleTime: 15_000 },
  );

  const mutation = useAuthorizedMutation<{ ok: true }, { clubId: string; isActive: boolean }>(setClubActive, {
    invalidate: [adminKeys.clubs(debounced), adminKeys.overview],
    onSuccess: () => toast.success("Club updated."),
    onError: (err) => toast.error(getManagementErrorMessage(err, "Unable to update club.")),
  });

  return (
    <div>
      <Input
        placeholder="Search clubs by name"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="mb-4"
      />
      {query.isLoading ? (
        <div className="ios-card rounded-2xl p-6 text-center text-sm text-muted-foreground">Loading clubs…</div>
      ) : query.error ? (
        <div className="ios-card rounded-2xl p-6 text-center text-sm text-destructive">{getManagementErrorMessage(query.error, "Unable to load clubs.")}</div>
      ) : (query.data ?? []).length === 0 ? (
        <div className="ios-card rounded-2xl p-6 text-center text-sm text-muted-foreground">No clubs match.</div>
      ) : (
        <GroupedList>
          {(query.data ?? []).map((c) => (
            <ListRow
              key={c.id}
              icon={Building2}
              iconBg={c.isActive ? "bg-primary/10" : "bg-muted"}
              iconColor={c.isActive ? "text-primary" : "text-muted-foreground"}
              label={c.clubName}
              detail={`${c.universityName ?? "No university"} · ${c.hostEmail ?? "no owner"} · ${c.eventCount} event${c.eventCount === 1 ? "" : "s"}${c.isActive ? "" : " · inactive"}`}
              trailing={
                <Button
                  variant={c.isActive ? "destructive" : "hero"}
                  size="sm"
                  disabled={mutation.isPending}
                  onClick={(e) => {
                    e.preventDefault();
                    mutation.mutate({ clubId: c.id, isActive: !c.isActive });
                  }}
                >
                  {c.isActive ? "Deactivate" : "Activate"}
                </Button>
              }
              chevron={false}
            />
          ))}
        </GroupedList>
      )}
    </div>
  );
}

// ─── Universities ─────────────────────────────────────────────────────
function UniversitiesPanel() {
  const query = useAuthorizedQuery<AdminUniversityEntry[]>(
    adminKeys.universities,
    listAdminUniversities,
    undefined,
    { staleTime: 30_000 },
  );
  const [editing, setEditing] = React.useState<AdminUniversityEntry | null>(null);
  const [creating, setCreating] = React.useState(false);

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button variant="hero" size="sm" onClick={() => setCreating(true)}>Add university</Button>
      </div>
      <SectionLabel>Universities & allowed email domains</SectionLabel>
      {query.isLoading ? (
        <div className="ios-card rounded-2xl p-6 text-center text-sm text-muted-foreground">Loading…</div>
      ) : query.error ? (
        <div className="ios-card rounded-2xl p-6 text-center text-sm text-destructive">{getManagementErrorMessage(query.error, "Unable to load universities.")}</div>
      ) : (query.data ?? []).length === 0 ? (
        <div className="ios-card rounded-2xl p-6 text-center text-sm text-muted-foreground">No universities yet.</div>
      ) : (
        <GroupedList>
          {(query.data ?? []).map((u) => (
            <ListRow
              key={u.id}
              icon={ShieldCheck}
              label={u.name}
              detail={u.allowedEmailDomains.length ? u.allowedEmailDomains.join(", ") : "No domains set"}
              value={u.slug}
              onClick={() => setEditing(u)}
            />
          ))}
        </GroupedList>
      )}
      <UniversityDialog
        open={creating || !!editing}
        university={editing}
        onClose={() => { setEditing(null); setCreating(false); }}
      />
    </div>
  );
}

function UniversityDialog({
  open,
  university,
  onClose,
}: {
  open: boolean;
  university: AdminUniversityEntry | null;
  onClose: () => void;
}) {
  const [name, setName] = React.useState("");
  const [slug, setSlug] = React.useState("");
  const [domainsText, setDomainsText] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setName(university?.name ?? "");
      setSlug(university?.slug ?? "");
      setDomainsText((university?.allowedEmailDomains ?? []).join(", "));
      setError(null);
    }
  }, [open, university]);

  const mutation = useAuthorizedMutation<
    { ok: true; id: string },
    { universityId?: string; name: string; slug: string; allowedEmailDomains: string[] }
  >(upsertAdminUniversity, {
    invalidate: [adminKeys.universities, adminKeys.overview],
    onSuccess: () => {
      toast.success(university ? "University updated." : "University added.");
      onClose();
    },
    onError: (err) => setError(getManagementErrorMessage(err, "Unable to save university.")),
  });

  const handleSave = () => {
    const domains = domainsText
      .split(/[\s,]+/)
      .map((d) => d.trim().replace(/^@/, "").toLowerCase())
      .filter((d) => d.length > 0);
    setError(null);
    mutation.mutate({
      universityId: university?.id,
      name: name.trim(),
      slug: slug.trim().toLowerCase(),
      allowedEmailDomains: domains,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{university ? "Edit university" : "Add university"}</DialogTitle>
          <DialogDescription>Set the display name, slug, and the email domains hosts must use to register students.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-[13px] font-medium text-foreground">Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={160} />
          </div>
          <div>
            <label className="text-[13px] font-medium text-foreground">Slug</label>
            <Input value={slug} onChange={(e) => setSlug(e.target.value)} maxLength={80} placeholder="e.g. state-college" />
          </div>
          <div>
            <label className="text-[13px] font-medium text-foreground">Allowed email domains</label>
            <Textarea
              value={domainsText}
              onChange={(e) => setDomainsText(e.target.value)}
              rows={3}
              placeholder="example.edu, alumni.example.edu"
            />
            <p className="mt-1 text-[12px] text-muted-foreground">Comma or whitespace separated. Lowercase, no leading “@”.</p>
          </div>
          {error ? <p className="text-[13px] text-destructive">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="hero" disabled={mutation.isPending} onClick={handleSave}>
            {mutation.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
