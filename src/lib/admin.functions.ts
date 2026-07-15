// Admin console server fns.
//
// Trust model:
//   - `requireSupabaseAuth` proves the caller is a signed-in host.
//   - `requireAdminOrForbidden` proves the caller has the `admin` role in
//     `public.user_roles`. Non-admins get a generic 403 "not found"–flavored
//     message — no oracle telling the caller "admin only" vs "signed out".
//   - `getAdminMe` intentionally does NOT gate on admin so the Settings page
//     can render a client-side conditional without leaking a 403 for every
//     signed-in non-admin.
//
// All list/mutate fns run through the service-role admin client after the
// `requireAdmin` check so RLS doesn't accidentally hide rows a real admin
// needs to see (e.g. clubs owned by another host). No student PII is ever
// returned — the overview is aggregate counts only.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { z } from "zod";
import { safeMessage } from "@/lib/server-errors";
import {
  listAdminClubsSchema,
  listAdminHostsSchema,
  setClubActiveSchema,
  setHostDisabledSchema,
  upsertAdminUniversitySchema,
} from "@/lib/admin-schemas";

type AdminClient = SupabaseClient<Database>;

async function getAdminClient(): Promise<AdminClient> {
  const mod = await import("@/integrations/supabase/client.server");
  return mod.supabaseAdmin;
}

// Server-side admin gate. Uses the caller-scoped Supabase client (RLS as the
// caller) to read `user_roles` — that table's policy already lets users see
// their own role rows. We deliberately don't use the admin client here so a
// misconfigured RLS policy on user_roles can't silently escalate.
async function isAdmin(supabase: AdminClient, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) return false;
  return !!data;
}

function forbidden(): never {
  throw new Response(
    JSON.stringify({ error: "You don't have access to that." }),
    { status: 403, headers: { "Content-Type": "application/json" } },
  );
}

async function requireAdminOrForbidden(supabase: AdminClient, userId: string): Promise<void> {
  const ok = await isAdmin(supabase, userId);
  if (!ok) forbidden();
}

// ─────────────────────────────────────────────────────────────────────────────
// getAdminMe — safe for every signed-in host to call (used by Settings).
// ─────────────────────────────────────────────────────────────────────────────
export const getAdminMe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ isAdmin: boolean }> => {
    return { isAdmin: await isAdmin(context.supabase, context.userId) };
  });

// ─────────────────────────────────────────────────────────────────────────────
// Overview — aggregate metrics, no student PII.
// ─────────────────────────────────────────────────────────────────────────────
export type AdminOverview = {
  hosts: { total: number; disabled: number };
  clubs: { total: number; inactive: number };
  events: { last7Days: number };
  checkIns: { last7Days: number; last30Days: number };
  universities: number;
  students: number;
};

export const getAdminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminOverview> => {
    await requireAdminOrForbidden(context.supabase, context.userId);
    const admin = await getAdminClient();

    const now = new Date();
    const iso7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const iso30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const date7 = iso7.slice(0, 10);

    const [
      hostsTotal,
      hostsDisabled,
      clubsTotal,
      clubsInactive,
      events7,
      ci7,
      ci30,
      unis,
      studs,
    ] = await Promise.all([
      admin.from("host_profiles").select("*", { count: "exact", head: true }),
      admin.from("host_profiles").select("*", { count: "exact", head: true }).eq("is_disabled", true),
      admin.from("clubs").select("*", { count: "exact", head: true }),
      admin.from("clubs").select("*", { count: "exact", head: true }).eq("is_active", false),
      admin.from("events").select("*", { count: "exact", head: true }).gte("event_date", date7),
      admin.from("attendance_records").select("*", { count: "exact", head: true }).gte("checked_in_at", iso7),
      admin.from("attendance_records").select("*", { count: "exact", head: true }).gte("checked_in_at", iso30),
      admin.from("universities").select("*", { count: "exact", head: true }),
      admin.from("students").select("*", { count: "exact", head: true }),
    ]);

    return {
      hosts: { total: hostsTotal.count ?? 0, disabled: hostsDisabled.count ?? 0 },
      clubs: { total: clubsTotal.count ?? 0, inactive: clubsInactive.count ?? 0 },
      events: { last7Days: events7.count ?? 0 },
      checkIns: { last7Days: ci7.count ?? 0, last30Days: ci30.count ?? 0 },
      universities: unis.count ?? 0,
      students: studs.count ?? 0,
    };
  });

// ─────────────────────────────────────────────────────────────────────────────
// Hosts
// ─────────────────────────────────────────────────────────────────────────────
export type AdminHostEntry = {
  id: string;
  fullName: string;
  email: string;
  createdAt: string;
  isDisabled: boolean;
  disabledAt: string | null;
  disabledReason: string | null;
  clubCount: number;
};

const HOSTS_LIMIT = 200;

export const listAdminHosts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(listAdminHostsSchema)
  .handler(async ({ context, data }): Promise<AdminHostEntry[]> => {
    await requireAdminOrForbidden(context.supabase, context.userId);
    const admin = await getAdminClient();
    let query = admin
      .from("host_profiles")
      .select("id, full_name, email, created_at, is_disabled, disabled_at, disabled_reason")
      .order("created_at", { ascending: false })
      .limit(HOSTS_LIMIT);
    const q = (data.q ?? "").trim();
    if (q) {
      const like = `%${q.replace(/[%_]/g, (m) => `\\${m}`)}%`;
      query = query.or(`full_name.ilike.${like},email.ilike.${like}`);
    }
    const { data: rows, error } = await query;
    if (error) throw new Error(safeMessage(error, "Unable to load hosts."));
    const ids = (rows ?? []).map((r) => r.id);
    // Owner-club count per host (the `sync_club_owner_membership` trigger
    // guarantees every club owner has a matching `club_members` row, so we
    // don't need to also union in the legacy `clubs.host_id` column).
    const counts: Record<string, number> = {};
    if (ids.length) {
      const { data: memRows } = await admin
        .from("club_members")
        .select("user_id, role")
        .in("user_id", ids)
        .eq("role", "owner");
      for (const m of memRows ?? []) {
        counts[m.user_id] = (counts[m.user_id] ?? 0) + 1;
      }
    }
    return (rows ?? []).map((r) => ({
      id: r.id,
      fullName: r.full_name,
      email: r.email,
      createdAt: r.created_at,
      isDisabled: !!r.is_disabled,
      disabledAt: r.disabled_at,
      disabledReason: r.disabled_reason,
      clubCount: counts[r.id] ?? 0,
    }));
  });

export const setHostDisabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(setHostDisabledSchema)
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    await requireAdminOrForbidden(context.supabase, context.userId);
    if (data.hostId === context.userId) {
      throw new Error("You cannot disable your own account.");
    }
    const admin = await getAdminClient();
    const patch = data.disabled
      ? {
          is_disabled: true,
          disabled_at: new Date().toISOString(),
          disabled_reason: (data.reason ?? "").trim() || null,
        }
      : {
          is_disabled: false,
          disabled_at: null,
          disabled_reason: null,
        };
    const { error } = await admin.from("host_profiles").update(patch).eq("id", data.hostId);
    if (error) throw new Error(safeMessage(error, "Unable to update host."));
    return { ok: true };
  });

// ─────────────────────────────────────────────────────────────────────────────
// Clubs
// ─────────────────────────────────────────────────────────────────────────────
export type AdminClubEntry = {
  id: string;
  clubName: string;
  clubSlug: string;
  isActive: boolean;
  universityName: string | null;
  hostEmail: string | null;
  hostName: string | null;
  createdAt: string;
  eventCount: number;
};

const CLUBS_LIMIT = 200;

export const listAdminClubs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(listAdminClubsSchema)
  .handler(async ({ context, data }): Promise<AdminClubEntry[]> => {
    await requireAdminOrForbidden(context.supabase, context.userId);
    const admin = await getAdminClient();

    let query = admin
      .from("clubs")
      .select(
        "id, club_name, club_slug, is_active, host_id, created_at, universities(id, name), host_profiles!clubs_host_id_fkey(id, full_name, email), events(id)",
      )
      .order("created_at", { ascending: false })
      .limit(CLUBS_LIMIT);
    const q = (data.q ?? "").trim();
    if (q) {
      const like = `%${q.replace(/[%_]/g, (m) => `\\${m}`)}%`;
      query = query.ilike("club_name", like);
    }
    const { data: rows, error } = await query;
    if (error) throw new Error(safeMessage(error, "Unable to load clubs."));

    return (rows ?? []).map((r) => {
      const university = (r.universities ?? null) as { name: string } | null;
      const host = (r.host_profiles ?? null) as { full_name: string; email: string } | null;
      const events = (r.events ?? []) as Array<{ id: string }>;
      return {
        id: r.id,
        clubName: r.club_name,
        clubSlug: r.club_slug,
        isActive: r.is_active,
        universityName: university?.name ?? null,
        hostEmail: host?.email ?? null,
        hostName: host?.full_name ?? null,
        createdAt: r.created_at,
        eventCount: events.length,
      };
    });
  });

export const setClubActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(setClubActiveSchema)
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    await requireAdminOrForbidden(context.supabase, context.userId);
    const admin = await getAdminClient();
    const { error } = await admin
      .from("clubs")
      .update({ is_active: data.isActive })
      .eq("id", data.clubId);
    if (error) throw new Error(safeMessage(error, "Unable to update club."));
    return { ok: true };
  });

// ─────────────────────────────────────────────────────────────────────────────
// Universities
// ─────────────────────────────────────────────────────────────────────────────
export type AdminUniversityEntry = {
  id: string;
  name: string;
  slug: string;
  allowedEmailDomains: string[];
  createdAt: string;
};

export const listAdminUniversities = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminUniversityEntry[]> => {
    await requireAdminOrForbidden(context.supabase, context.userId);
    const admin = await getAdminClient();
    const { data, error } = await admin
      .from("universities")
      .select("id, name, slug, allowed_email_domains, created_at")
      .order("name", { ascending: true })
      .limit(200);
    if (error) throw new Error(safeMessage(error, "Unable to load universities."));
    return (data ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      allowedEmailDomains: r.allowed_email_domains ?? [],
      createdAt: r.created_at,
    }));
  });

export const upsertAdminUniversity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(upsertAdminUniversitySchema)
  .handler(async ({ context, data }): Promise<{ ok: true; id: string }> => {
    await requireAdminOrForbidden(context.supabase, context.userId);
    const admin = await getAdminClient();

    // Normalize + dedup domains (schema already lowercased each entry)
    const domains = Array.from(new Set(data.allowedEmailDomains.filter((d) => d.length > 0))).sort();

    if (data.universityId) {
      const { error } = await admin
        .from("universities")
        .update({ name: data.name, slug: data.slug, allowed_email_domains: domains })
        .eq("id", data.universityId);
      if (error) throw new Error(safeMessage(error, "Unable to update university."));
      return { ok: true, id: data.universityId };
    }
    const { data: created, error } = await admin
      .from("universities")
      .insert({ name: data.name, slug: data.slug, allowed_email_domains: domains })
      .select("id")
      .single();
    if (error || !created) throw new Error(safeMessage(error, "Unable to create university."));
    return { ok: true, id: created.id };
  });

// Re-export the Zod input types for the UI layer to keep imports centralised.
export type { z };
