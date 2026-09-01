// Owner Admin (application-owner) server functions.
//
// Trust model — three independent layers, all server-side:
//   1. `requireSupabaseAuth` proves the caller has a valid Supabase session.
//   2. `requireOwnerAdmin` re-reads the caller's authoritative email from the
//      auth system with the service-role client and compares it to
//      OWNER_ADMIN_EMAIL. The browser is never trusted for this.
//   3. The `owner_admin_*` SQL reporting functions are revoked from `anon` and
//      `authenticated`, so even a stolen/forged bearer token cannot reach them
//      through the Data API — only trusted server code can call them.
//
// Non-owners get a generic 404-flavoured error: nothing in the response hints
// that owner tooling exists.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import { safeMessage } from "@/lib/server-errors";
import {
  OWNER_ADMIN_EMAIL,
  attendanceQuerySchema,
  dateRangeSchema,
  eventsQuerySchema,
  organizationDetailSchema,
  organizationsQuerySchema,
  paginationSchema,
} from "@/lib/owner-admin-schemas";

type AdminClient = SupabaseClient<Database>;

async function getAdminClient(): Promise<AdminClient> {
  const mod = await import("@/integrations/supabase/client.server");
  return mod.supabaseAdmin;
}

function notFound(): never {
  throw new Response(JSON.stringify({ error: "Not found." }), {
    status: 404,
    headers: { "Content-Type": "application/json" },
  });
}

/** Authoritative owner check. Reads the email from the auth system, not the client. */
async function isOwnerAdmin(userId: string): Promise<boolean> {
  try {
    const admin = await getAdminClient();
    const { data, error } = await admin.auth.admin.getUserById(userId);
    if (error || !data?.user?.email) return false;
    return data.user.email.trim().toLowerCase() === OWNER_ADMIN_EMAIL;
  } catch {
    return false;
  }
}

async function requireOwnerAdmin(userId: string): Promise<AdminClient> {
  if (!(await isOwnerAdmin(userId))) notFound();
  return getAdminClient();
}

async function callReport<T>(
  admin: AdminClient,
  fn: string,
  args: Record<string, unknown>,
  fallback: string,
): Promise<T> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any).rpc(fn, args);
  if (error) throw new Error(safeMessage(error, fallback));
  return data as T;
}

// ─────────────────────────────────────────────────────────────────────────────
// Entry-point probe. Safe for any signed-in host to call: returns a boolean
// only, so the account menu can conditionally render the Owner Admin link.
// ─────────────────────────────────────────────────────────────────────────────
export const getOwnerAdminMe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ isOwnerAdmin: boolean }> => {
    return { isOwnerAdmin: await isOwnerAdmin(context.userId) };
  });

// ─────────────────────────────────────────────────────────────────────────────
// Overview + charts
// ─────────────────────────────────────────────────────────────────────────────
export type OwnerOverview = {
  organizations: {
    total: number;
    newToday: number;
    newThisWeek: number;
    newThisMonth: number;
    active7d: number;
    active30d: number;
    dormant: number;
    atRisk: number;
    neverActivated: number;
  };
  members: { total: number; newThisMonth: number; avgPerOrganization: number; withAttendance: number };
  events: { total: number; thisWeek: number; thisMonth: number; avgPerActiveOrganization: number };
  attendance: {
    total: number;
    today: number;
    thisWeek: number;
    thisMonth: number;
    uniqueThisMonth: number;
    avgPerEvent: number;
  };
  northStar: { currentMonth: number; previousMonth: number; monthLabel: string };
};

export const getOwnerOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<OwnerOverview> => {
    const admin = await requireOwnerAdmin(context.userId);
    return callReport<OwnerOverview>(admin, "owner_admin_overview", {}, "Unable to load overview.");
  });

// ─────────────────────────────────────────────────────────────────────────────
// People summary — the plain-language "who is on the app and do they come
// back?" report that drives the simplified overview screen.
// ─────────────────────────────────────────────────────────────────────────────
export type OwnerPeople = {
  members: { total: number; newThisMonth: number; checkedIn: number; repeat: number };
  hosts: { total: number; newThisMonth: number; organizations: number; withOrganization: number };
  checkIns: { total: number; thisMonth: number; previousMonth: number; monthLabel: string };
  frequency: { label: string; people: number }[];
  returning: { lastMonthAttendees: number; returnedThisMonth: number };
};

export const getOwnerPeople = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<OwnerPeople> => {
    const admin = await requireOwnerAdmin(context.userId);
    return callReport<OwnerPeople>(admin, "owner_admin_people", {}, "Unable to load people summary.");
  });


export type OwnerSeriesPoint = {
  bucket: string;
  newOrganizations: number;
  totalOrganizations: number;
  checkIns: number;
  eventsCreated: number;
  newMembers: number;
  totalMembers: number;
  activeOrganizations: number;
};

export const getOwnerSeries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(dateRangeSchema)
  .handler(async ({ context, data }): Promise<OwnerSeriesPoint[]> => {
    const admin = await requireOwnerAdmin(context.userId);
    const rows = await callReport<OwnerSeriesPoint[] | null>(
      admin,
      "owner_admin_series",
      { _from: data.from, _to: data.to, _bucket: data.bucket },
      "Unable to load trends.",
    );
    return rows ?? [];
  });

// ─────────────────────────────────────────────────────────────────────────────
// Organizations
// ─────────────────────────────────────────────────────────────────────────────
export type OwnerOrgRow = {
  club_id: string;
  club_name: string;
  club_slug: string;
  created_at: string;
  is_active: boolean;
  university_id: string | null;
  university_name: string | null;
  owner_id: string | null;
  owner_name: string | null;
  owner_email: string | null;
  admin_count: number;
  member_count: number;
  members_new_30d: number;
  members_attended: number;
  event_count: number;
  events_30d: number;
  first_event_created_at: string | null;
  second_event_created_at: string | null;
  last_event_date: string | null;
  next_event_date: string | null;
  checkins_total: number;
  checkins_30d: number;
  unique_attendees: number;
  repeat_attendees: number;
  first_checkin_at: string | null;
  last_checkin_at: string | null;
  last_admin_sign_in: string | null;
  feature_count: number;
  last_activity: string;
  days_since_activity: number;
  score_recency: number;
  score_event_frequency: number;
  score_volume: number;
  score_admin: number;
  score_features: number;
  health_score: number;
  status: string;
};

export type OwnerOrgPage = { total: number; limit: number; offset: number; rows: OwnerOrgRow[] };

export const listOwnerOrganizations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(organizationsQuerySchema)
  .handler(async ({ context, data }): Promise<OwnerOrgPage> => {
    const admin = await requireOwnerAdmin(context.userId);
    return callReport<OwnerOrgPage>(
      admin,
      "owner_admin_organizations",
      {
        _q: data.q ?? null,
        _status: data.status === "all" ? null : data.status,
        _university_id: data.universityId ?? null,
        _sort: data.sort,
        _dir: data.dir,
        _limit: data.limit,
        _offset: data.offset,
      },
      "Unable to load organizations.",
    );
  });

export type OwnerOrgAdministrator = {
  userId: string;
  name: string | null;
  email: string | null;
  role: string;
  addedAt: string;
  lastSignInAt: string | null;
};

export type OwnerOrgDetail = {
  stats: OwnerOrgRow;
  administrators: OwnerOrgAdministrator[];
  recentEvents: {
    id: string;
    name: string;
    date: string;
    createdAt: string;
    checkIns: number;
    preCheckIns: number;
  }[];
  timeline: { at: string; type: string; label: string }[];
};

export const getOwnerOrganizationDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(organizationDetailSchema)
  .handler(async ({ context, data }): Promise<OwnerOrgDetail> => {
    const admin = await requireOwnerAdmin(context.userId);
    const detail = await callReport<OwnerOrgDetail | null>(
      admin,
      "owner_admin_organization_detail",
      { _club_id: data.clubId },
      "Unable to load organization.",
    );
    if (!detail) notFound();
    return detail;
  });

export const listOwnerUniversities = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ id: string; name: string }[]> => {
    const admin = await requireOwnerAdmin(context.userId);
    const { data, error } = await admin.from("universities").select("id, name").order("name");
    if (error) throw new Error(safeMessage(error, "Unable to load universities."));
    return data ?? [];
  });

// ─────────────────────────────────────────────────────────────────────────────
// Users / Members / Events / Attendance
// ─────────────────────────────────────────────────────────────────────────────
export type OwnerUsersReport = {
  metrics: Record<string, number>;
  total: number;
  limit: number;
  offset: number;
  rows: {
    id: string;
    name: string;
    email: string;
    createdAt: string;
    isDisabled: boolean;
    lastSignInAt: string | null;
    organizations: number;
    roles: string;
    eventsCreated: number;
    isStaffAdmin: boolean;
  }[];
};

export const getOwnerUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(paginationSchema)
  .handler(async ({ context, data }): Promise<OwnerUsersReport> => {
    const admin = await requireOwnerAdmin(context.userId);
    return callReport<OwnerUsersReport>(
      admin,
      "owner_admin_users",
      { _q: data.q ?? null, _limit: data.limit, _offset: data.offset },
      "Unable to load users.",
    );
  });

export type OwnerMembersReport = {
  metrics: Record<string, number>;
  total: number;
  limit: number;
  offset: number;
  rows: {
    id: string;
    name: string;
    email: string;
    university: string | null;
    createdAt: string;
    checkIns: number;
    eventsAttended: number;
    organizations: number;
    firstAttendance: string | null;
    lastAttendance: string | null;
  }[];
};

export const getOwnerMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(paginationSchema)
  .handler(async ({ context, data }): Promise<OwnerMembersReport> => {
    const admin = await requireOwnerAdmin(context.userId);
    return callReport<OwnerMembersReport>(
      admin,
      "owner_admin_members",
      { _q: data.q ?? null, _limit: data.limit, _offset: data.offset },
      "Unable to load members.",
    );
  });

export type OwnerEventsReport = {
  metrics: {
    total: number;
    today: number;
    thisWeek: number;
    thisMonth: number;
    avgPerOrganization: number;
    avgAttendance: number;
    medianAttendance: number;
    zeroAttendance: number;
    largestEvent: { name: string; checkIns: number; date: string } | null;
    mostActiveOrganization: { name: string; checkIns: number } | null;
  };
  total: number;
  limit: number;
  offset: number;
  rows: {
    id: string;
    name: string;
    organization: string;
    clubId: string;
    date: string;
    createdAt: string;
    checkIns: number;
    uniqueAttendees: number;
    preCheckIns: number;
    status: string;
  }[];
};

export const getOwnerEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(eventsQuerySchema)
  .handler(async ({ context, data }): Promise<OwnerEventsReport> => {
    const admin = await requireOwnerAdmin(context.userId);
    return callReport<OwnerEventsReport>(
      admin,
      "owner_admin_events",
      {
        _q: data.q ?? null,
        _club_id: data.clubId ?? null,
        _from: data.from ?? null,
        _to: data.to ?? null,
        _limit: data.limit,
        _offset: data.offset,
      },
      "Unable to load events.",
    );
  });

export type OwnerAttendanceReport = {
  metrics: {
    lifetime: number;
    today: number;
    thisWeek: number;
    thisMonth: number;
    inRange: number;
    uniqueAttendees: number;
    avgPerEvent: number;
    avgPerOrganization: number;
    repeatRate: number;
    preCheckIns: number;
    methodBreakdown: Record<string, number>;
    duplicateAttempts: number;
    failedAttempts: number;
  };
  byDayOfWeek: { day: number; checkIns: number }[];
  byHour: { hour: number; checkIns: number }[];
  topOrganizations: { name: string; clubId: string; checkIns: number }[];
  largestEvents: { name: string; eventId: string; date: string; checkIns: number }[];
};

export const getOwnerAttendance = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(attendanceQuerySchema)
  .handler(async ({ context, data }): Promise<OwnerAttendanceReport> => {
    const admin = await requireOwnerAdmin(context.userId);
    return callReport<OwnerAttendanceReport>(
      admin,
      "owner_admin_attendance",
      { _from: data.from, _to: data.to },
      "Unable to load attendance analytics.",
    );
  });

// ─────────────────────────────────────────────────────────────────────────────
// Activation / Retention / Product usage / System health
// ─────────────────────────────────────────────────────────────────────────────
export type OwnerActivationReport = {
  funnel: { stage: string; count: number }[];
  activationRate: number;
  timings: {
    signupToOrganizationDays: number;
    organizationToFirstEventDays: number;
    organizationToFirstCheckInDays: number;
    firstToSecondEventDays: number;
  };
  neverActivated: {
    clubId: string;
    name: string;
    owner: string | null;
    ownerEmail: string | null;
    createdAt: string;
    events: number;
    members: number;
  }[];
  stalled: {
    clubId: string;
    name: string;
    owner: string | null;
    ownerEmail: string | null;
    createdAt: string;
    events: number;
    members: number;
    reason: string;
  }[];
};

export const getOwnerActivation = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<OwnerActivationReport> => {
    const admin = await requireOwnerAdmin(context.userId);
    return callReport<OwnerActivationReport>(admin, "owner_admin_activation", {}, "Unable to load activation.");
  });

export type OwnerRetentionReport = {
  metrics: {
    retained7d: number;
    retained30d: number;
    retained60d: number;
    retained90d: number;
    dormant: number;
    atRisk: number;
    reactivated: number;
    avgDaysBetweenEvents: number;
  };
  cohorts: { cohort: string; size: number; months: { offset: number; retained: number }[] | null }[];
};

export const getOwnerRetention = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<OwnerRetentionReport> => {
    const admin = await requireOwnerAdmin(context.userId);
    return callReport<OwnerRetentionReport>(admin, "owner_admin_retention", {}, "Unable to load retention.");
  });

export type OwnerFeatureUsage = {
  key: string;
  label: string;
  source: "historical" | "tracked";
  total: number;
  orgs: number;
  last7d: number;
  last30d: number;
};

export type OwnerProductUsageReport = {
  organizationCount: number;
  features: OwnerFeatureUsage[];
  tracked: OwnerFeatureUsage[];
  trackingSince: string | null;
};

export const getOwnerProductUsage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<OwnerProductUsageReport> => {
    const admin = await requireOwnerAdmin(context.userId);
    return callReport<OwnerProductUsageReport>(
      admin,
      "owner_admin_product_usage",
      {},
      "Unable to load product usage.",
    );
  });

export type OwnerSystemHealthReport = {
  trackingSince: string | null;
  counts: {
    checkInFailed: number;
    duplicateCheckIn: number;
    rateLimited: number;
    serverErrors: number;
    checkInFailed7d: number;
    serverErrors7d: number;
    activeRateLimitBuckets: number;
    expiredDeviceSessions: number;
  };
  recent: {
    id: string;
    at: string;
    type: string;
    organization: string | null;
    eventId: string | null;
    userId: string | null;
    metadata: Json;
  }[];
  errorsByDay: { bucket: string; errors: number }[];
};

export const getOwnerSystemHealth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<OwnerSystemHealthReport> => {
    const admin = await requireOwnerAdmin(context.userId);
    return callReport<OwnerSystemHealthReport>(
      admin,
      "owner_admin_system_health",
      { _limit: 50 },
      "Unable to load system health.",
    );
  });
