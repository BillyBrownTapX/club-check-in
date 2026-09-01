// Owner Admin layout. Every child renders inside the gate below.
//
// This is a UX gate only: server functions re-verify the caller's email
// against the auth system, and the SQL reports are revoked from the
// `authenticated` role, so a bypassed browser gate exposes nothing.

import { createFileRoute, Outlet } from "@tanstack/react-router";

import { LoadingBlock, OwnerAdminShell, useOwnerAdminGate } from "@/components/owner-admin/ui";

export const Route = createFileRoute("/owner-admin")({
  head: () => ({
    meta: [
      { title: "Owner console — Attendance HQ" },
      { name: "description", content: "Internal Attendance HQ platform analytics." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: OwnerAdminLayout,
});

function OwnerAdminLayout() {
  const gate = useOwnerAdminGate();

  if (!gate.ready) {
    return (
      <div className="min-h-screen bg-background">
        <LoadingBlock label={gate.checking ? "Loading…" : "Redirecting…"} />
      </div>
    );
  }

  return (
    <OwnerAdminShell>
      <Outlet />
    </OwnerAdminShell>
  );
}
