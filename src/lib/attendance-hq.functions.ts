import { createHash } from "crypto";
import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { notFound } from "@tanstack/react-router";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireHostActive } from "@/lib/host-active.middleware";
import type { Database } from "@/integrations/supabase/types";
import {
  buildEventDefaults,
  buildHostOnboardingState,
  type AttendanceActionLog,
  type AttendanceActionStudentSnapshot,
  type AttendanceRow,
  type Club,
  CLUB_REPORT_MAX_EVENTS,
  CLUB_REPORT_MAX_STUDENTS,
  type ClubAttendanceReportPayload,
  type ClubAttendanceReportStudent,
  type ClubDetailPayload,
  type ClubSummary,
  combineDateAndTime,
  createDeviceToken,
  createQrToken,
  type EventAttendanceSummary,
  type EventDisplayPayload,
  type EventFormPayload,
  type EventFormValues,
  type EventOperationsPayload,
  type EventSummary,
  type EventTemplateWithClub,
  type EventWithClub,
  getCheckInMethodLabel,
  getCheckInStatus,
  getAttendanceRetentionCutoffDate,
  getDefaultClubReportRange,
  isDeviceSessionExpired,
  type HostOnboardingState,
  type HostActivityEntry,
  type HostActivityType,
  type HostProfile,
  type ManagementEventSummary,
  maskEmail,
  normalizeEmail,
  buildDefaultPreCheckInWindow,
  getPreCheckInStatus,
  type PreCheckInRow,
  type PublicStudentPreview,
  shiftPreCheckInWindowByDays,
  type University,
  shiftEventScheduleByDays,
  shiftTimeString,
  slugifyClubName,
  WEEKLY_MEETING_TEMPLATE_DEFAULTS,
} from "@/lib/attendance-hq";
async function getSupabaseAdmin() {
  const mod = await import("@/integrations/supabase/client.server");
  return mod.supabaseAdmin;
}
async function rateLimit(scope: "lookup" | "register" | "fast", qrToken: string) {
  const mod = await import("@/lib/rate-limit.server");
  await mod.assertRateLimit(scope, qrToken);
}


import {
  addClubOfficerSchema,
  clubAttendanceReportSchema,
  clubIdInputSchema,
  clubIdOptionalInputSchema,
  clubSchema,
  clubUpdateSchema,
  closeCheckInEarlySchema,
  regenerateEventQrTokenSchema,
  confirmReturningInputSchema,
  correctStudentProfileSchema,
  deleteClubSchema,
  deleteEventSchema,
  duplicateEventSchema,
  duplicateEventTemplateSchema,
  eventFormPayloadInputSchema,
  eventIdInputSchema,
  eventSchema,
  eventListFilterSchema,
  eventTemplateSchema,
  eventTemplateUpdateSchema,
  eventUpdateSchema,
  fastCheckInSchema,
  hostOnboardingInputSchema,
  manualAttendanceSchema,
  preCheckInRegistrationInputSchema,
  preCheckInReturningInputSchema,
  preCheckInTokenInputSchema,
  qrTokenSchema,
  regeneratePreCheckInTokenSchema,
  togglePreCheckInSchema,
  rememberedDeviceInputSchema,
  removeAttendanceSchema,
  purgeClubAttendanceSchema,
  removeClubOfficerSchema,
  restoreAttendanceSchema,
  returningLookupInputSchema,
  saveEventAsTemplateSchema,
  studentCheckInInputSchema,
  toggleEventArchiveSchema,
  transferClubOwnershipSchema,
  validatedEventSchema,
} from "@/lib/attendance-hq-schemas";
import { safeMessage } from "@/lib/server-errors";
import { z } from "zod";

// PII-safe log helper for public check-in server fns. Logs a tagged line
// with the operation name, a hashed qrToken, and a sanitized message
// only — never names, emails, 900 numbers, student ids, device tokens,
// or the raw qrToken. Business outcomes returned as `{ ok: false, state }`
// are normal flow and MUST NOT be routed through this helper.
type PublicCheckInOp =
  | "studentCheckIn"
  | "lookupStudent"
  | "confirmReturningStudent"
  | "fastCheckIn"
  | "getRememberedStudent"
  | "getPublicEventDisplay"
  | "getPublicEventByQr";

function hashQrTokenForLog(qrToken: string | undefined | null): string {
  if (!qrToken) return "none";
  return createHash("sha256").update(qrToken).digest("hex").slice(0, 12);
}

function logCheckInError(op: PublicCheckInOp, qrToken: string | undefined | null, err: unknown): void {
  if (typeof console === "undefined") return;
  const e = err as { code?: string; message?: string } | null;
  console.error("[check-in] failed", {
    op,
    qrHash: hashQrTokenForLog(qrToken),
    code: e?.code,
    // Route the message through safeMessage so nothing sensitive lands in
    // the log line. This mirrors the copy the caller ultimately sees.
    message: safeMessage(e ?? null, e?.message ?? "unknown error"),
  });
}

// Wraps a public check-in server-fn handler so any thrown error is
// logged (once, tagged, PII-free) before being re-thrown. Business
// outcomes returned as `{ ok: false, state }` pass through untouched.
function withCheckInLog<A extends { data: { qrToken?: string } }, R>(
  op: PublicCheckInOp,
  fn: (args: A) => Promise<R>,
): (args: A) => Promise<R> {
  return async (args) => {
    try {
      return await fn(args);
    } catch (err) {
      logCheckInError(op, args?.data?.qrToken, err);
      throw err;
    }
  };
}



async function ensureHostProfile(userId: string, fallback?: { fullName?: string | null; email?: string | null }) {
  const { data: existingProfile, error: existingError } = await (await getSupabaseAdmin())
    .from("host_profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (existingError) throw new Error(safeMessage(existingError));
  if (existingProfile) return existingProfile as HostProfile;

  const fullName = fallback?.fullName?.trim() || fallback?.email?.split("@")[0] || "Host";
  const email = fallback?.email?.trim().toLowerCase();

  const { data: createdProfile, error: createError } = await (await getSupabaseAdmin())
    .from("host_profiles")
    .upsert({ id: userId, full_name: fullName, email: email ?? `${userId}@attendancehq.local` }, { onConflict: "id" })
    .select("*")
    .single();

  if (createError || !createdProfile) throw new Error(safeMessage(createError, "Unable to create host profile"));
  return createdProfile as HostProfile;
}

// Picks the user's most-stable "primary" club for onboarding: prefer an
// owner membership, else any membership (including officer-only), else fall
// back to a legacy clubs.host_id match. Ordered by club.created_at ASC.
async function resolveFirstAccessibleClub(
  supabase: AppSupabaseClient,
  userId: string,
): Promise<{ data: Club | null; error: unknown }> {
  const { data: memberships, error: membershipError } = await supabase
    .from("club_members")
    .select("club_id, role, clubs!inner(*)")
    .eq("user_id", userId);
  if (membershipError) return { data: null, error: membershipError };

  const clubsList = ((memberships ?? []) as Array<{ role: string; clubs: Club }>)
    .map((row) => ({ role: row.role, club: row.clubs }))
    .filter((row) => row.club);

  clubsList.sort((a, b) => {
    if (a.role === "owner" && b.role !== "owner") return -1;
    if (a.role !== "owner" && b.role === "owner") return 1;
    return a.club.created_at.localeCompare(b.club.created_at);
  });

  if (clubsList.length) return { data: clubsList[0].club, error: null };

  const { data: legacy, error: legacyError } = await supabase
    .from("clubs")
    .select("*")
    .eq("host_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (legacyError) return { data: null, error: legacyError };
  return { data: (legacy as Club | null) ?? null, error: null };
}

async function resolveHostOnboardingState(userId: string): Promise<HostOnboardingState> {
  const admin = await getSupabaseAdmin();
  const [{ data: profile, error: profileError }, { data: club, error: clubError }] = await Promise.all([
    admin.from("host_profiles").select("*").eq("id", userId).maybeSingle(),
    resolveFirstAccessibleClub(admin, userId),
  ]);

  if (profileError) throw new Error(safeMessage(profileError));
  if (clubError) throw new Error(safeMessage(clubError));

  let event = null;
  if (club?.id) {
    const { data: firstEvent, error: eventError } = await (await getSupabaseAdmin())
      .from("events")
      .select("*")
      .eq("club_id", club.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (eventError) throw new Error(safeMessage(eventError));
    event = firstEvent;
  }

  return buildHostOnboardingState({
    profile: (profile as HostProfile | null) ?? null,
    club: (club as Club | null) ?? null,
    event: (event as EventWithClub | null) ?? null,
  });
}

async function requireHostProfile(userId: string) {
  const { data, error } = await (await getSupabaseAdmin()).from("host_profiles").select("*").eq("id", userId).single();
  if (error || !data) throw new Error("Host profile not found");
  return data as HostProfile;
}

export const getPublicEventByQr = createServerFn({ method: "GET" })
  .inputValidator(z.object({ qrToken: qrTokenSchema }))
  .handler(withCheckInLog("getPublicEventByQr", async ({ data }) => {
    const { data: event, error } = await (await getSupabaseAdmin())
      .from("events")
      .select("*, clubs(id, club_name, club_slug, description)")
      .eq("qr_token", data.qrToken)
      .maybeSingle();

    if (error) throw new Error(safeMessage(error));
    if (!event) throw notFound();

    return event as EventWithClub;
  }));

// ─────────────────────────────────────────────────────────────────────────────
// Removed in Phase 1 (security): signUpHost / signInHost / sendPasswordReset /
// completePasswordReset.
//
// Why removed:
//   • signInHost called auth.admin.listUsers() and matched on email only —
//     it returned `ok: true` for ANY email that existed, with NO password
//     verification. Anyone who could call this server function could log in
//     as any host.
//   • signUpHost used auth.admin.createUser({ email_confirm: true }) which
//     bypassed Supabase's email verification flow entirely.
//   • sendPasswordReset/completePasswordReset used the service-role admin
//     API to reset arbitrary users' passwords — privilege escalation surface
//     with no defensible product reason.
//
// All four were unused: the actual sign-in/sign-up/forgot-password/reset
// pages call the Supabase browser SDK directly. They are removed so the
// privileged paths cannot be invoked at all.
// ─────────────────────────────────────────────────────────────────────────────

// Single canonical "where is this host in the onboarding flow?" entry point.
// All auth-handoff routes (sign-in / sign-up / reset-password) and the
// onboarding pages call this — there is intentionally no client-side
// equivalent. It also idempotently bootstraps the host_profile row so
// downstream code (clubs, events, etc.) never has to defend against a
// missing profile. The optional input lets sign-up seed the friendly
// `full_name` captured at registration without any other call site
// having to know about it.
export const getHostOnboardingState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(hostOnboardingInputSchema)
  .handler(async ({ data, context }) => {
    const claimsEmail = typeof context.claims.email === "string" ? context.claims.email : null;
    const profile = await ensureHostProfile(context.userId, {
      fullName: data?.fullName ?? null,
      email: data?.email ?? claimsEmail,
    });
    const onboarding = await resolveHostOnboardingState(context.userId);
    return { profile, onboarding };
  });

// PostgREST returns embedded `attendance_records(count)` as `[{ count: N }]`.
// Older callers may still embed `attendance_records(id)` (an array of rows).
// Read either shape so we can roll the optimization out per-call without breaking
// any consumer that hasn't been migrated yet.
function extractAttendanceCount(
  records: EventSummary["attendance_records"] | undefined,
): number {
  if (!records || records.length === 0) return 0;
  const first = records[0] as { count?: number; id?: string };
  if (typeof first.count === "number") return first.count;
  return records.length;
}

function toManagementEventSummary(event: EventSummary): ManagementEventSummary {
  return {
    ...event,
    attendanceCount: extractAttendanceCount(event.attendance_records),
    checkInStatus: getCheckInStatus(event),
  };
}

const EVENT_STATUS_ORDER: Record<ManagementEventSummary["checkInStatus"], number> = {
  open: 0,
  upcoming: 1,
  closed: 2,
  inactive: 3,
  archived: 4,
};

type AttendanceActionNotePayload = {
  kind: "manual_check_in" | "removed" | "restored" | "profile_corrected" | "qr_token_regenerated";
  studentId?: string;
  firstName?: string;
  lastName?: string;
  studentEmail?: string;
  nineHundredNumber?: string;
  checkedInAt?: string | null;
  attendanceRecordId?: string | null;
};

function buildAttendanceActionNotes(payload: AttendanceActionNotePayload) {
  return JSON.stringify(payload);
}

function parseAttendanceActionLog(action: Database["public"]["Tables"]["attendance_actions"]["Row"]): AttendanceActionLog | null {
  if (!action.notes) return null;
  try {
    const parsed = JSON.parse(action.notes) as Partial<AttendanceActionNotePayload>;
    // Event-scoped notes without a student (e.g. QR token regenerated) still
    // belong in the action log — no PII, just the kind.
    if (parsed.kind === "qr_token_regenerated") {
      return {
        ...action,
        student: null,
        checkedInAt: null,
        attendanceRecordId: null,
        kind: parsed.kind,
      };
    }
    if (!parsed.studentId || !parsed.firstName || !parsed.lastName || !parsed.studentEmail || !parsed.nineHundredNumber) {
      return null;
    }
    return {
      ...action,
      student: {
        id: parsed.studentId,
        first_name: parsed.firstName,
        last_name: parsed.lastName,
        student_email: parsed.studentEmail,
        nine_hundred_number: parsed.nineHundredNumber,
      },
      checkedInAt: parsed.checkedInAt ?? null,
      attendanceRecordId: parsed.attendanceRecordId ?? action.attendance_record_id,
      kind: parsed.kind ?? null,
    };
  } catch {
    return null;
  }
}

function buildEventAttendanceSummary(
  attendance: AttendanceRow[],
  removedCount: number,
  recentActions: AttendanceActionLog[],
): EventAttendanceSummary {
  const recentCutoff = Date.now() - 15 * 60 * 1000;
  const summary: EventAttendanceSummary = {
    total: attendance.length,
    recent: 0,
    removedCount,
    lastActionAt: recentActions[0]?.created_at ?? null,
    methodBreakdown: {
      firstScan: 0,
      returning: 0,
      remembered: 0,
      manual: 0,
    },
  };

  for (const row of attendance) {
    if (new Date(row.checked_in_at).getTime() >= recentCutoff) summary.recent += 1;
    if (row.check_in_method === "qr_scan") summary.methodBreakdown.firstScan += 1;
    else if (row.check_in_method === "returning_lookup") summary.methodBreakdown.returning += 1;
    else if (row.check_in_method === "remembered_device") summary.methodBreakdown.remembered += 1;
    else summary.methodBreakdown.manual += 1;
  }

  return summary;
}

type AppSupabaseClient = SupabaseClient<Database>;

async function resolveHostOnboardingStateWithClient(supabase: AppSupabaseClient, userId: string): Promise<HostOnboardingState> {
  const [{ data: profile, error: profileError }, { data: club, error: clubError }] = await Promise.all([
    supabase.from("host_profiles").select("*").eq("id", userId).maybeSingle(),
    resolveFirstAccessibleClub(supabase, userId),
  ]);

  if (profileError) throw new Error(safeMessage(profileError));
  if (clubError) throw new Error(safeMessage(clubError));

  let event = null;
  if (club?.id) {
    const { data: firstEvent, error: eventError } = await supabase
      .from("events")
      .select("*")
      .eq("club_id", club.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (eventError) throw new Error(safeMessage(eventError));
    event = firstEvent;
  }

  return buildHostOnboardingState({
    profile: (profile as HostProfile | null) ?? null,
    club: (club as Club | null) ?? null,
    event: (event as EventWithClub | null) ?? null,
  });
}

// Returns every club id the user can access as either an owner or officer
// via club_members, unioned with any club where they are still the legacy
// clubs.host_id (fallback so a missing membership row never bricks an owner).
async function getAccessibleClubIds(supabase: AppSupabaseClient, userId: string) {
  const [memberships, ownedClubs] = await Promise.all([
    supabase.from("club_members").select("club_id").eq("user_id", userId),
    supabase.from("clubs").select("id").eq("host_id", userId),
  ]);
  if (memberships.error) throw new Error(safeMessage(memberships.error));
  if (ownedClubs.error) throw new Error(safeMessage(ownedClubs.error));

  const ids = new Set<string>();
  for (const row of memberships.data ?? []) ids.add(row.club_id);
  for (const row of ownedClubs.data ?? []) ids.add(row.id);
  return Array.from(ids);
}

// Member-level access: owner OR officer via club_members, or legacy host_id.
// notFound() on absence to avoid leaking club existence to non-members.
async function requireClubAccess(supabase: AppSupabaseClient, userId: string, clubId: string) {
  const [{ data: club, error: clubError }, { data: membership, error: membershipError }] = await Promise.all([
    supabase.from("clubs").select("*, universities(id, name, slug)").eq("id", clubId).maybeSingle(),
    supabase.from("club_members").select("role").eq("club_id", clubId).eq("user_id", userId).maybeSingle(),
  ]);
  if (clubError) throw new Error(safeMessage(clubError));
  if (membershipError) throw new Error(safeMessage(membershipError));
  if (!club) throw notFound();

  const isHost = club.host_id === userId;
  if (!membership && !isHost) throw notFound();

  return club as Club & { universities?: Pick<University, "id" | "name" | "slug"> | null };
}

// Owner-only. Used exclusively for destructive club-level ops (e.g. deleteClub).
async function requireClubOwner(supabase: AppSupabaseClient, userId: string, clubId: string) {
  const [{ data: club, error: clubError }, { data: membership, error: membershipError }] = await Promise.all([
    supabase.from("clubs").select("*, universities(id, name, slug)").eq("id", clubId).maybeSingle(),
    supabase.from("club_members").select("role").eq("club_id", clubId).eq("user_id", userId).maybeSingle(),
  ]);
  if (clubError) throw new Error(safeMessage(clubError));
  if (membershipError) throw new Error(safeMessage(membershipError));
  if (!club) throw notFound();

  const isHost = club.host_id === userId;
  const isOwner = membership?.role === "owner";
  if (!isOwner && !isHost) throw notFound();

  return club as Club & { universities?: Pick<University, "id" | "name" | "slug"> | null };
}

async function requireOwnedEvent(supabase: AppSupabaseClient, userId: string, eventId: string) {
  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("*")
    .eq("id", eventId)
    .maybeSingle();

  if (eventError) throw new Error(safeMessage(eventError, undefined, "read"));
  if (!event) throw notFound();

  const club = await requireClubAccess(supabase, userId, event.club_id);

  return {
    ...(event as Database["public"]["Tables"]["events"]["Row"]),
    clubs: {
      id: club.id,
      club_name: club.club_name,
      club_slug: club.club_slug,
      description: club.description,
      university_id: club.university_id,
      universities: club.universities ?? null,
    },
  } as EventWithClub;
}

async function getHostClubSummariesForUser(supabase: AppSupabaseClient, userId: string): Promise<ClubSummary[]> {
  const accessibleIds = await getAccessibleClubIds(supabase, userId);
  if (!accessibleIds.length) return [];

  const { data: clubs, error: clubsError } = await supabase
    .from("clubs")
    .select("*, universities(id, name, slug)")
    .in("id", accessibleIds)
    .order("created_at", { ascending: true });

  if (clubsError) throw new Error(safeMessage(clubsError));

  const clubIds = (clubs ?? []).map((club) => club.id);
  const { data: events, error: eventsError } = clubIds.length
    ? await supabase
        .from("events")
        // attendance_records(count) returns a single aggregate row per event
        // instead of one row per check-in. On busy clubs this is the difference
        // between transferring tens of thousands of ids and a handful of ints.
        .select("id, club_id, event_date, check_in_opens_at, check_in_closes_at, is_active, is_archived, attendance_records(count)")
        .in("club_id", clubIds)
    : { data: [], error: null };

  if (eventsError) throw new Error(safeMessage(eventsError));

  const now = new Date().toISOString().slice(0, 10);
  const counts = new Map<string, { upcomingEventsCount: number; pastEventsCount: number; totalCheckIns: number }>();
  for (const club of clubs ?? []) {
    counts.set(club.id, { upcomingEventsCount: 0, pastEventsCount: 0, totalCheckIns: 0 });
  }

  for (const event of (events ?? []) as Array<{ club_id: string; event_date: string; attendance_records?: { count: number }[] }>) {
    const current = counts.get(event.club_id);
    if (!current) continue;
    if (event.event_date >= now) current.upcomingEventsCount += 1;
    else current.pastEventsCount += 1;
    current.totalCheckIns += event.attendance_records?.[0]?.count ?? 0;
  }

  return ((clubs ?? []) as Club[]).map((club) => ({
    ...club,
    ...(counts.get(club.id) ?? { upcomingEventsCount: 0, pastEventsCount: 0, totalCheckIns: 0 }),
  })) as ClubSummary[];
}

async function getUniversities(supabase: AppSupabaseClient) {
  const { data, error } = await supabase.from("universities").select("*").order("name", { ascending: true });
  if (error) throw new Error(safeMessage(error, "Unable to load universities."));
  return (data ?? []) as University[];
}

async function getHostTemplatesForUser(supabase: AppSupabaseClient, userId: string, clubId?: string) {
  const clubIds = clubId ? [clubId] : await getAccessibleClubIds(supabase, userId);
  if (!clubIds.length) return [] as EventTemplateWithClub[];

  const { data: templates, error } = await supabase
    .from("event_templates")
    .select("*, clubs(id, club_name, club_slug)")
    .in("club_id", clubIds)
    .order("created_at", { ascending: false });

  if (error) throw new Error(safeMessage(error));
  return (templates ?? []) as EventTemplateWithClub[];
}

async function getHostEventsForUser(
  supabase: AppSupabaseClient,
  userId: string,
  filters: { clubId?: string; status: "all" | "active" | "upcoming" | "past"; query?: string },
) {
  const clubIds = filters.clubId ? [filters.clubId] : await getAccessibleClubIds(supabase, userId);
  if (!clubIds.length) return [] as ManagementEventSummary[];

  let query = supabase
    .from("events")
    .select("*, clubs(id, club_name, club_slug), attendance_records(count)")
    .in("club_id", clubIds)
    .order("event_date", { ascending: true })
    .order("start_time", { ascending: true });

  if (filters.query) query = query.ilike("event_name", `%${filters.query}%`);

  const { data: events, error } = await query;
  if (error) throw new Error(safeMessage(error));

  const normalized = ((events ?? []) as EventSummary[]).map(toManagementEventSummary);
  const filtered = normalized.filter((event) => {
    if (filters.status === "active") {
      return event.checkInStatus === "open" || event.checkInStatus === "upcoming";
    }
    if (filters.status === "upcoming") return event.checkInStatus === "upcoming";
    if (filters.status === "past") {
      return ["closed", "inactive", "archived"].includes(event.checkInStatus);
    }
    return true;
  });

  return filtered.sort((a, b) => {
    if (filters.status === "all") {
      const rankDifference = EVENT_STATUS_ORDER[a.checkInStatus] - EVENT_STATUS_ORDER[b.checkInStatus];
      if (rankDifference !== 0) return rankDifference;
    }

    const aStamp = new Date(`${a.event_date}T${a.start_time}`).getTime();
    const bStamp = new Date(`${b.event_date}T${b.start_time}`).getTime();
    const descendingStatuses = new Set<ManagementEventSummary["checkInStatus"]>(["closed", "inactive", "archived"]);
    const descending = filters.status === "past" || descendingStatuses.has(a.checkInStatus);
    return descending ? bStamp - aStamp : aStamp - bStamp;
  });
}

async function createEventForUser(
  supabase: AppSupabaseClient,
  userId: string,
  data: z.infer<typeof validatedEventSchema>,
) {
  const club = await requireClubAccess(supabase, userId, data.clubId);

  const { data: event, error } = await supabase
    .from("events")
    .insert({
      club_id: data.clubId,
      university_id: club.university_id,
      event_template_id: data.eventTemplateId || null,
      event_name: data.eventName.trim(),
      event_date: data.eventDate,
      start_time: data.startTime,
      end_time: data.endTime,
      location: data.location?.trim() || null,
      check_in_opens_at: data.checkInOpensAt,
      check_in_closes_at: data.checkInClosesAt,
      qr_token: createQrToken(),
      // Pre-event head count is opt-in. The DB trigger enforces the window
      // rules; we only pass through what the host asked for, and mint a
      // distinct token so the marketing link never exposes the day-of QR.
      pre_check_in_enabled: data.preCheckInEnabled ?? false,
      pre_check_in_opens_at: data.preCheckInEnabled ? (data.preCheckInOpensAt || null) : null,
      pre_check_in_closes_at: data.preCheckInEnabled ? (data.preCheckInClosesAt || null) : null,
      pre_check_in_token: data.preCheckInEnabled ? createQrToken() : null,
    })
    .select("*, clubs(id, club_name, club_slug, description, university_id, universities(id, name, slug))")
    .single();

  if (error || !event) throw new Error(safeMessage(error, "Unable to create event"));
  return {
    event: event as EventWithClub,
    onboarding: await resolveHostOnboardingStateWithClient(supabase, userId),
  };
}

export const getHostWorkspace = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const profile = await requireHostProfile(context.userId);
    const clubs = await getHostClubSummariesForUser(context.supabase, context.userId);
    const events = await getHostEventsForUser(context.supabase, context.userId, { clubId: "", status: "all", query: "" });
    const templates = await getHostTemplatesForUser(context.supabase, context.userId);

    return {
      profile,
      clubs,
      templates,
      events,
    };
  });

export const getHostClubSummaries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    return getHostClubSummariesForUser(context.supabase, context.userId);
  });

export const getUniversitiesForHost = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    return getUniversities(context.supabase);
  });

export const getHostTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(clubIdOptionalInputSchema)
  .handler(async ({ data, context }) => {
    return getHostTemplatesForUser(context.supabase, context.userId, data.clubId);
  });

export const getHostEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(eventListFilterSchema)
  .handler(async ({ data, context }) => {
    return getHostEventsForUser(context.supabase, context.userId, data);
  });

export const getClubDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(clubIdInputSchema)
  .handler(async ({ data, context }) => {
    const club = await requireClubAccess(context.supabase, context.userId, data.clubId);

    const [universities, { data: events, error: eventsError }, { data: templates, error: templatesError }] = await Promise.all([
      getUniversities(context.supabase),
      context.supabase
        .from("events")
        .select("*, clubs(id, club_name, club_slug, university_id, universities(id, name, slug)), attendance_records(count)")
        .eq("club_id", club.id)
        .order("event_date", { ascending: false })
        .order("start_time", { ascending: false }),
      context.supabase
        .from("event_templates")
        .select("*, clubs(id, club_name, club_slug)")
        .eq("club_id", club.id)
        .order("created_at", { ascending: false }),
    ]);

    if (eventsError) throw new Error(safeMessage(eventsError));
    if (templatesError) throw new Error(safeMessage(templatesError));

    // Soft backfill: existing clubs created before the seed-on-create change
    // (or where the seed failed) end up with zero templates. Insert a
    // Weekly Meeting template idempotently so the templates surface stops
    // being an empty section hosts ignore. Best-effort — never fails the
    // detail load.
    let templatesList = (templates ?? []) as EventTemplateWithClub[];
    if (templatesList.length === 0) {
      try {
        const { data: seeded } = await context.supabase
          .from("event_templates")
          .insert({ club_id: club.id, ...WEEKLY_MEETING_TEMPLATE_DEFAULTS })
          .select("*, clubs(id, club_name, club_slug)")
          .single();
        if (seeded) templatesList = [seeded as EventTemplateWithClub];
      } catch (backfillError) {
        console.warn("[getClubDetail] weekly template backfill skipped:", backfillError instanceof Error ? backfillError.message : "unknown");
      }
    }

    // Members: hosts can only SELECT their own host_profiles under RLS, so
    // join member rows to profile name/email via the admin client after the
    // requireClubAccess gate above.
    const admin = await getSupabaseAdmin();
    const { data: memberRows, error: memberError } = await admin
      .from("club_members")
      .select("id, user_id, role, created_at")
      .eq("club_id", club.id);
    if (memberError) throw new Error(safeMessage(memberError, "Unable to load club members."));

    const memberUserIds = (memberRows ?? []).map((row) => row.user_id);
    const profileMap = new Map<string, { full_name: string | null; email: string | null }>();
    if (memberUserIds.length) {
      const { data: profiles, error: profilesError } = await admin
        .from("host_profiles")
        .select("id, full_name, email")
        .in("id", memberUserIds);
      if (profilesError) throw new Error(safeMessage(profilesError, "Unable to load member profiles."));
      for (const profile of profiles ?? []) {
        profileMap.set(profile.id, { full_name: profile.full_name, email: profile.email });
      }
    }

    const members = (memberRows ?? []).map((row) => {
      const profile = profileMap.get(row.user_id);
      return {
        id: row.id,
        userId: row.user_id,
        role: row.role as "owner" | "officer",
        fullName: profile?.full_name ?? "",
        email: profile?.email ?? "",
        createdAt: row.created_at,
      };
    }).sort((a, b) => {
      if (a.role !== b.role) return a.role === "owner" ? -1 : 1;
      return a.createdAt.localeCompare(b.createdAt);
    });

    const viewerMembership = members.find((m) => m.userId === context.userId) ?? null;
    const isLegacyHost = club.host_id === context.userId;
    const viewerRole: "owner" | "officer" | null = viewerMembership
      ? (viewerMembership.role === "owner" || isLegacyHost ? "owner" : "officer")
      : (isLegacyHost ? "owner" : null);

    const today = new Date().toISOString().slice(0, 10);
    const normalizedEvents = ((events ?? []) as EventSummary[]).map(toManagementEventSummary);
    const upcomingEvents = normalizedEvents.filter((event) => event.event_date >= today);
    const pastEvents = normalizedEvents.filter((event) => event.event_date < today);
    const totalCheckIns = normalizedEvents.reduce((sum, event) => sum + event.attendanceCount, 0);

    return {
      club,
      universities,
      stats: {
        upcomingEvents: upcomingEvents.length,
        pastEvents: pastEvents.length,
        totalCheckIns,
      },
      upcomingEvents,
      pastEvents,
      templates: templatesList,
      members,
      viewerRole,
    } as ClubDetailPayload;
  });

export const addClubOfficer = createServerFn({ method: "POST" })
  .middleware([requireHostActive])
  .inputValidator(addClubOfficerSchema)
  .handler(async ({ data, context }) => {
    await requireClubOwner(context.supabase, context.userId, data.clubId);

    const admin = await getSupabaseAdmin();
    const { data: profile, error: profileError } = await admin
      .from("host_profiles")
      .select("id")
      .eq("email", data.email)
      .maybeSingle();
    if (profileError) throw new Error(safeMessage(profileError, "Unable to look up host."));
    if (!profile) {
      throw new Error("No Attendance HQ host account with that email. Ask them to sign up first.");
    }

    if (profile.id === context.userId) {
      throw new Error("You're already on this club.");
    }

    const { data: existing, error: existingError } = await admin
      .from("club_members")
      .select("id")
      .eq("club_id", data.clubId)
      .eq("user_id", profile.id)
      .maybeSingle();
    if (existingError) throw new Error(safeMessage(existingError, "Unable to check membership."));
    if (existing) {
      throw new Error("That host is already a member of this club.");
    }

    const { error: insertError } = await admin
      .from("club_members")
      .insert({ club_id: data.clubId, user_id: profile.id, role: "officer" });
    if (insertError) throw new Error(safeMessage(insertError, "Unable to add officer."));

    return { ok: true };
  });

export const removeClubOfficer = createServerFn({ method: "POST" })
  .middleware([requireHostActive])
  .inputValidator(removeClubOfficerSchema)
  .handler(async ({ data, context }) => {
    await requireClubOwner(context.supabase, context.userId, data.clubId);

    const admin = await getSupabaseAdmin();
    const { data: membership, error: membershipError } = await admin
      .from("club_members")
      .select("id, club_id, role")
      .eq("id", data.membershipId)
      .maybeSingle();
    if (membershipError) throw new Error(safeMessage(membershipError, "Unable to load membership."));
    if (!membership || membership.club_id !== data.clubId) {
      throw new Error("Officer not found on this club.");
    }
    if (membership.role !== "officer") {
      throw new Error("Only officers can be removed.");
    }

    const { error: deleteError } = await admin
      .from("club_members")
      .delete()
      .eq("id", membership.id);
    if (deleteError) throw new Error(safeMessage(deleteError, "Unable to remove officer."));

    return { ok: true };
  });

export const transferClubOwnership = createServerFn({ method: "POST" })
  .middleware([requireHostActive])
  .inputValidator(transferClubOwnershipSchema)
  .handler(async ({ data, context }) => {
    await requireClubOwner(context.supabase, context.userId, data.clubId);

    const admin = await getSupabaseAdmin();

    // Load target officer membership.
    const { data: target, error: targetError } = await admin
      .from("club_members")
      .select("id, club_id, user_id, role")
      .eq("id", data.membershipId)
      .maybeSingle();
    if (targetError) throw new Error(safeMessage(targetError, "Unable to load membership."));
    if (!target || target.club_id !== data.clubId) {
      throw new Error("Officer not found on this club.");
    }
    if (target.role === "owner") {
      throw new Error("That member is already the owner.");
    }
    if (target.role !== "officer") {
      throw new Error("Officer not found on this club.");
    }
    if (target.user_id === context.userId) {
      throw new Error("You're already the owner.");
    }

    // 1. Sync clubs.host_id to new owner.
    const { error: hostError } = await admin
      .from("clubs")
      .update({ host_id: target.user_id })
      .eq("id", data.clubId);
    if (hostError) throw new Error(safeMessage(hostError, "Ownership transfer failed."));

    // 2. Demote every existing owner (including acting owner) to officer,
    //    excluding the target so we don't flip it back.
    const { error: demoteError } = await admin
      .from("club_members")
      .update({ role: "officer", updated_at: new Date().toISOString() })
      .eq("club_id", data.clubId)
      .eq("role", "owner")
      .neq("user_id", target.user_id);
    if (demoteError) throw new Error(safeMessage(demoteError, "Ownership transfer failed."));

    // 3. Promote target to owner.
    const { error: promoteError } = await admin
      .from("club_members")
      .update({ role: "owner", updated_at: new Date().toISOString() })
      .eq("id", target.id);
    if (promoteError) throw new Error(safeMessage(promoteError, "Ownership transfer failed."));

    // Verify exactly one owner and host_id matches.
    const [{ data: owners, error: ownersError }, { data: clubRow, error: clubError }] = await Promise.all([
      admin.from("club_members").select("user_id").eq("club_id", data.clubId).eq("role", "owner"),
      admin.from("clubs").select("host_id").eq("id", data.clubId).maybeSingle(),
    ]);
    if (ownersError || clubError) throw new Error("Ownership transfer failed. Contact support.");
    if (!owners || owners.length !== 1 || !clubRow || clubRow.host_id !== owners[0].user_id) {
      throw new Error("Ownership transfer failed. Contact support.");
    }

    return { ok: true };
  });


export const createClubManagement = createServerFn({ method: "POST" })
  .middleware([requireHostActive])
  .inputValidator(clubSchema)
  .handler(async ({ data, context }) => {
    const baseSlug = slugifyClubName(data.clubName);
    const slug = `${baseSlug || "club"}-${Math.random().toString(36).slice(2, 6)}`;

    const { data: club, error } = await context.supabase
      .from("clubs")
      .insert({
        host_id: context.userId,
        university_id: data.universityId,
        club_name: data.clubName.trim(),
        club_slug: slug,
        description: data.description?.trim() || null,
        logo_url: data.logoPath?.trim() || null,
      })
      .select("*")
      .single();

    if (error || !club) throw new Error(safeMessage(error, "Unable to create club"));

    // Best-effort seed: new clubs start with a Weekly Meeting template so
    // hosts see the templates section as a working default, not an empty
    // list. Failure here must NOT roll back the club — it's a UX nicety.
    try {
      await context.supabase.from("event_templates").insert({
        club_id: club.id,
        ...WEEKLY_MEETING_TEMPLATE_DEFAULTS,
      });
    } catch (seedError) {
      console.warn("[createClubManagement] weekly template seed skipped:", seedError instanceof Error ? seedError.message : "unknown");
    }

    return club as Club;
  });

export const updateClub = createServerFn({ method: "POST" })
  .middleware([requireHostActive])
  .inputValidator(clubUpdateSchema)
  .handler(async ({ data, context }) => {
    await requireClubAccess(context.supabase, context.userId, data.clubId);

    // The slug is the public identifier minted at insert time. Rotating it
    // on every name edit would silently break any external links/QR/
    // bookmarks pointing at the club. Hosts can't edit slugs from the UI,
    // so updates intentionally leave club_slug untouched.
    const { data: club, error } = await context.supabase
      .from("clubs")
      .update({
        university_id: data.universityId,
        club_name: data.clubName.trim(),
        description: data.description?.trim() || null,
        is_active: data.isActive,
        logo_url: data.logoPath === undefined ? undefined : (data.logoPath?.trim() || null),
      })
      .eq("id", data.clubId)
      .select("*")
      .single();

    if (error || !club) throw new Error(safeMessage(error, "Unable to update club"));
    return club as Club;
  });

export const createEventTemplate = createServerFn({ method: "POST" })
  .middleware([requireHostActive])
  .inputValidator(eventTemplateSchema)
  .handler(async ({ data, context }) => {
    await requireClubAccess(context.supabase, context.userId, data.clubId);

    const { data: template, error } = await context.supabase
      .from("event_templates")
      .insert({
        club_id: data.clubId,
        template_name: data.templateName.trim(),
        default_event_name: data.defaultEventName?.trim() || null,
        default_location: data.defaultLocation?.trim() || null,
        default_start_time: data.defaultStartTime || null,
        default_end_time: data.defaultEndTime || null,
        default_check_in_open_offset_minutes: data.defaultCheckInOpenOffsetMinutes,
        default_check_in_close_offset_minutes: data.defaultCheckInCloseOffsetMinutes,
      })
      .select("*, clubs(id, club_name, club_slug)")
      .single();

    if (error || !template) throw new Error(safeMessage(error, "Unable to create template"));
    return template as EventTemplateWithClub;
  });

export const updateEventTemplate = createServerFn({ method: "POST" })
  .middleware([requireHostActive])
  .inputValidator(eventTemplateUpdateSchema)
  .handler(async ({ data, context }) => {
    await requireClubAccess(context.supabase, context.userId, data.clubId);

    const { data: template, error } = await context.supabase
      .from("event_templates")
      .update({
        template_name: data.templateName.trim(),
        default_event_name: data.defaultEventName?.trim() || null,
        default_location: data.defaultLocation?.trim() || null,
        default_start_time: data.defaultStartTime || null,
        default_end_time: data.defaultEndTime || null,
        default_check_in_open_offset_minutes: data.defaultCheckInOpenOffsetMinutes,
        default_check_in_close_offset_minutes: data.defaultCheckInCloseOffsetMinutes,
      })
      .eq("id", data.templateId)
      .eq("club_id", data.clubId)
      .select("*, clubs(id, club_name, club_slug)")
      .single();

    if (error || !template) throw new Error(safeMessage(error, "Unable to update template"));
    return template as EventTemplateWithClub;
  });

export const duplicateEventTemplate = createServerFn({ method: "POST" })
  .middleware([requireHostActive])
  .inputValidator(duplicateEventTemplateSchema)
  .handler(async ({ data, context }) => {
    // 1. Look up the template via the user-scoped (RLS-enforced) client. If
    //    the host doesn't own the template's club, RLS returns null and we
    //    bail with notFound() instead of leaking the row.
    const { data: template, error } = await context.supabase
      .from("event_templates")
      .select("*")
      .eq("id", data.templateId)
      .maybeSingle();

    if (error) throw new Error(safeMessage(error));
    if (!template) throw notFound();

    // 2. Defense-in-depth: explicitly verify the host owns the destination
    //    club. Without this, any future refactor that swaps the SELECT to an
    //    admin client would silently re-introduce cross-tenant duplication.
    await requireClubAccess(context.supabase, context.userId, template.club_id);

    const { data: duplicated, error: duplicateError } = await context.supabase
      .from("event_templates")
      .insert({
        club_id: template.club_id,
        template_name: `${template.template_name} copy`,
        default_event_name: template.default_event_name,
        default_location: template.default_location,
        default_start_time: template.default_start_time,
        default_end_time: template.default_end_time,
        default_check_in_open_offset_minutes: template.default_check_in_open_offset_minutes,
        default_check_in_close_offset_minutes: template.default_check_in_close_offset_minutes,
      })
      .select("*, clubs(id, club_name, club_slug)")
      .single();

    if (duplicateError || !duplicated) throw new Error(safeMessage(duplicateError, "Unable to duplicate template"));
    return duplicated as EventTemplateWithClub;
  });

export const saveEventAsTemplate = createServerFn({ method: "POST" })
  .middleware([requireHostActive])
  .inputValidator(saveEventAsTemplateSchema)
  .handler(async ({ data, context }) => {
    const event = await requireOwnedEvent(context.supabase, context.userId, data.eventId);

    // Reverse getEventFormPayload's template math:
    //   open_ts  = combineDateAndTime(event_date, start_time) − openOffset(min)
    //   close_ts = combineDateAndTime(event_date, end_time)   + closeOffset(min)
    // Positive stored offsets mean "N min before start" / "N min after end".
    const clampOffset = (mins: number) => Math.max(-1440, Math.min(1440, Math.round(mins)));

    const startMs = new Date(`${event.event_date}T${event.start_time}`).getTime();
    const endTime = event.end_time ?? event.start_time;
    const endMs = new Date(`${event.event_date}T${endTime}`).getTime();
    const openMs = new Date(event.check_in_opens_at).getTime();
    const closeMs = new Date(event.check_in_closes_at).getTime();

    const openOffset = Number.isFinite(startMs) && Number.isFinite(openMs)
      ? clampOffset((startMs - openMs) / 60000)
      : 15;
    const closeOffset = Number.isFinite(endMs) && Number.isFinite(closeMs)
      ? clampOffset((closeMs - endMs) / 60000)
      : 15;

    const rawName = (data.templateName ?? "").trim();
    const templateName = rawName.length ? rawName.slice(0, 120) : `${event.event_name} template`.slice(0, 120);

    const { data: template, error } = await context.supabase
      .from("event_templates")
      .insert({
        club_id: event.club_id,
        template_name: templateName,
        default_event_name: event.event_name || null,
        default_location: event.location || null,
        default_start_time: event.start_time,
        default_end_time: endTime,
        default_check_in_open_offset_minutes: openOffset,
        default_check_in_close_offset_minutes: closeOffset,
      })
      .select("*, clubs(id, club_name, club_slug)")
      .single();

    if (error || !template) throw new Error(safeMessage(error, "Unable to save template"));
    return template as EventTemplateWithClub;
  });

export const getEventFormPayload = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(eventFormPayloadInputSchema)
  .handler(async ({ data, context }) => {
    const [universities, clubIds] = await Promise.all([getUniversities(context.supabase), getAccessibleClubIds(context.supabase, context.userId)]);
    const clubs = clubIds.length
      ? ((await context.supabase.from("clubs").select("*, universities(id, name, slug)").in("id", clubIds).order("club_name", { ascending: true })).data ?? [])
      : [];
    const templates = clubIds.length
      ? ((await context.supabase.from("event_templates").select("*, clubs(id, club_name, club_slug)").in("club_id", clubIds).order("template_name", { ascending: true })).data ?? [])
      : [];

    let initialValues: EventFormValues = {
      clubId: data.clubId,
      eventTemplateId: "",
      eventName: "New event",
      eventDate: buildEventDefaults().eventDate,
      startTime: buildEventDefaults().startTime,
      endTime: buildEventDefaults().endTime,
      location: "",
      checkInOpensAt: buildEventDefaults().checkInOpensAt,
      checkInClosesAt: buildEventDefaults().checkInClosesAt,
      preCheckInEnabled: false,
      preCheckInOpensAt: "",
      preCheckInClosesAt: "",
    };

    if (!initialValues.clubId && clubs.length) initialValues.clubId = (clubs[0] as Club).id;

    if (data.templateId) {
      const template = (templates as EventTemplateWithClub[]).find((item) => item.id === data.templateId);
      if (template) {
        const defaults = buildEventDefaults();
        const startTime = template.default_start_time || defaults.startTime;
        const endTime = template.default_end_time || defaults.endTime;
        // Template offsets are stored as positive integers and mean
        //   open  = startTime − openOffsetMinutes  (minutes before start)
        //   close = endTime   + closeOffsetMinutes (minutes after end)
        // Pre-fix the close offset was applied to startTime, which silently
        // computed a check-in close that was usually BEFORE end_time. The
        // open offset also went through Math.abs which masked any negative
        // value the host may have intentionally entered.
        const openOffset = template.default_check_in_open_offset_minutes;
        const closeOffset = template.default_check_in_close_offset_minutes;
        initialValues = {
          ...initialValues,
          clubId: template.club_id,
          eventTemplateId: template.id,
          eventName: template.default_event_name || "",
          location: template.default_location || "",
          startTime,
          endTime,
          checkInOpensAt: combineDateAndTime(defaults.eventDate, `${shiftTimeString(startTime, -openOffset)}:00`),
          checkInClosesAt: combineDateAndTime(defaults.eventDate, `${shiftTimeString(endTime, closeOffset)}:00`),
        };
      }
    }

    if (data.eventId || data.duplicateFrom) {
      const sourceEvent = await requireOwnedEvent(context.supabase, context.userId, data.eventId || data.duplicateFrom);
      const isDuplicate = Boolean(data.duplicateFrom);
      const schedule = isDuplicate
        ? shiftEventScheduleByDays(
            {
              eventDate: sourceEvent.event_date,
              checkInOpensAt: sourceEvent.check_in_opens_at,
              checkInClosesAt: sourceEvent.check_in_closes_at,
            },
            7,
          )
        : {
            eventDate: sourceEvent.event_date,
            checkInOpensAt: sourceEvent.check_in_opens_at,
            checkInClosesAt: sourceEvent.check_in_closes_at,
          };
      initialValues = {
        clubId: sourceEvent.club_id,
        eventTemplateId: sourceEvent.event_template_id || "",
        eventName: sourceEvent.event_name,
        eventDate: schedule.eventDate,
        // Postgres returns "HH:MM:SS"; <input type="time"> and the form's
        // offset math expect "HH:MM".
        startTime: (sourceEvent.start_time ?? "").slice(0, 5),
        endTime: (sourceEvent.end_time ?? sourceEvent.start_time ?? "").slice(0, 5),

        location: sourceEvent.location || "",
        checkInOpensAt: schedule.checkInOpensAt,
        checkInClosesAt: schedule.checkInClosesAt,
        preCheckInEnabled: sourceEvent.pre_check_in_enabled,
        ...(() => {
          const window = isDuplicate
            ? shiftPreCheckInWindowByDays(
                {
                  preCheckInOpensAt: sourceEvent.pre_check_in_opens_at,
                  preCheckInClosesAt: sourceEvent.pre_check_in_closes_at,
                },
                7,
              )
            : {
                preCheckInOpensAt: sourceEvent.pre_check_in_opens_at,
                preCheckInClosesAt: sourceEvent.pre_check_in_closes_at,
              };
          return {
            preCheckInOpensAt: window.preCheckInOpensAt ?? "",
            preCheckInClosesAt: window.preCheckInClosesAt ?? "",
          };
        })(),
      };
    }

    return {
      clubs: clubs as EventFormPayload["clubs"],
      universities,
      templates: templates as EventTemplateWithClub[],
      initialValues,
      sourceEventId: data.duplicateFrom || undefined,
    } as EventFormPayload;
  });

export const createEvent = createServerFn({ method: "POST" })
  .middleware([requireHostActive])
  .inputValidator(validatedEventSchema)
  .handler(async ({ data, context }) => {
    return createEventForUser(context.supabase, context.userId, data);
  });

export const updateEvent = createServerFn({ method: "POST" })
  .middleware([requireHostActive])
  .inputValidator(eventUpdateSchema)
  .handler(async ({ data, context }) => {
    const existing = await requireOwnedEvent(context.supabase, context.userId, data.eventId);
    await requireClubAccess(context.supabase, context.userId, data.clubId);

    const { data: event, error } = await context.supabase
      .from("events")
      .update({
        club_id: data.clubId,
        event_template_id: data.eventTemplateId || null,
        event_name: data.eventName.trim(),
        event_date: data.eventDate,
        start_time: data.startTime,
        end_time: data.endTime,
        location: data.location?.trim() || null,
        check_in_opens_at: data.checkInOpensAt,
        check_in_closes_at: data.checkInClosesAt,
        is_active: true,
        is_archived: false,
        qr_token: existing.qr_token,
        pre_check_in_enabled: data.preCheckInEnabled ?? false,
        pre_check_in_opens_at: data.preCheckInEnabled ? (data.preCheckInOpensAt || null) : null,
        pre_check_in_closes_at: data.preCheckInEnabled ? (data.preCheckInClosesAt || null) : null,
        // Keep an existing pre-check-in link stable across edits so any
        // already-published marketing QR keeps working; mint one on first
        // enable. Disabling keeps the token so re-enabling reuses the link.
        pre_check_in_token: data.preCheckInEnabled
          ? (existing.pre_check_in_token ?? createQrToken())
          : existing.pre_check_in_token,
      })
      .eq("id", data.eventId)
      .select("*, clubs(id, club_name, club_slug, description)")
      .single();

    if (error || !event) throw new Error(safeMessage(error, "Unable to update event"));
    return event as EventWithClub;
  });

export const duplicateEvent = createServerFn({ method: "POST" })
  .middleware([requireHostActive])
  .inputValidator(duplicateEventSchema)
  .handler(async ({ data, context }) => {
    await requireOwnedEvent(context.supabase, context.userId, data.sourceEventId);
    const { sourceEventId: _sourceEventId, ...eventData } = data;
    return createEventForUser(context.supabase, context.userId, eventData);
  });

export const getEventOperations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(eventIdInputSchema)
  .handler(async ({ data, context }) => {
    const event = await requireOwnedEvent(context.supabase, context.userId, data.eventId);
    const [{ data: attendance, error: attendanceError }, { data: actions, error: actionsError }] = await Promise.all([
      context.supabase
        .from("attendance_records")
        .select("*, students(id, first_name, last_name, student_email, nine_hundred_number)")
        .eq("event_id", data.eventId)
        .order("checked_in_at", { ascending: false }),
      context.supabase
        .from("attendance_actions")
        .select("*")
        .eq("event_id", data.eventId)
        .order("created_at", { ascending: false })
        .limit(30),
    ]);

    if (attendanceError) throw new Error(safeMessage(attendanceError));
    if (actionsError) throw new Error(safeMessage(actionsError));

    const normalizedAttendance = (attendance ?? []) as AttendanceRow[];
    const recentActions = ((actions ?? []) as Database["public"]["Tables"]["attendance_actions"]["Row"][])
      .map(parseAttendanceActionLog)
      .filter((value): value is AttendanceActionLog => Boolean(value));
    const currentStudentIds = new Set(normalizedAttendance.map((row) => row.students?.id).filter(Boolean));
    const removedAttendanceMap = new Map<string, AttendanceActionLog>();

    for (const action of recentActions) {
      const studentId = action.student?.id;
      if (!studentId) continue;
      if (action.action_type === "restored") {
        removedAttendanceMap.delete(studentId);
        continue;
      }
      if (action.action_type === "removed" && !currentStudentIds.has(studentId) && !removedAttendanceMap.has(studentId)) {
        removedAttendanceMap.set(studentId, action);
      }
    }

    // Pre-event head count. Read separately and NEVER merged into the
    // attendance arrays — the whole point of the feature is that the real
    // attendance numbers stay clean.
    const { data: preRows, error: preError } = await context.supabase
      .from("pre_check_ins")
      .select("student_id")
      .eq("event_id", data.eventId);
    if (preError) throw new Error(safeMessage(preError));
    const preStudentIds = new Set((preRows ?? []).map((row) => row.student_id));
    const attendedStudentIds = new Set(
      normalizedAttendance.map((row) => row.students?.id).filter(Boolean) as string[],
    );
    let preCheckInConvertedCount = 0;
    for (const id of preStudentIds) if (attendedStudentIds.has(id)) preCheckInConvertedCount += 1;

    return {
      event,
      attendance: normalizedAttendance,
      removedAttendance: [...removedAttendanceMap.values()],
      recentActions,
      summary: buildEventAttendanceSummary(normalizedAttendance, removedAttendanceMap.size, recentActions),
      preCheckInCount: preStudentIds.size,
      preCheckInConvertedCount,
    } as EventOperationsPayload;
  });

export const getEventDisplayPayload = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(eventIdInputSchema)
  .handler(async ({ data, context }) => {
    const event = await requireOwnedEvent(context.supabase, context.userId, data.eventId);
    const [{ count: attendanceCount, error: attendanceCountError }, { data: actions, error: actionsError }] = await Promise.all([
      context.supabase
        .from("attendance_records")
        .select("id", { count: "exact", head: true })
        .eq("event_id", data.eventId),
      context.supabase
        .from("attendance_actions")
        .select("*")
        .eq("event_id", data.eventId)
        .order("created_at", { ascending: false })
        .limit(30),
    ]);

    if (attendanceCountError) throw new Error(safeMessage(attendanceCountError));
    if (actionsError) throw new Error(safeMessage(actionsError));

    const recentActions = ((actions ?? []) as Database["public"]["Tables"]["attendance_actions"]["Row"][])
      .map(parseAttendanceActionLog)
      .filter((value): value is AttendanceActionLog => Boolean(value));
    const removedCount = recentActions.reduce((total, action) => {
      if (action.action_type !== "removed" || !action.student?.id) return total;
      return total + 1;
    }, 0);

    return {
      event,
      attendanceCount: attendanceCount ?? 0,
      summary: buildEventAttendanceSummary([], removedCount, recentActions),
    } as EventDisplayPayload;
  });

export type PublicEventDisplayPayload =
  | {
      ok: true;
      event: {
        event_name: string;
        event_date: string;
        start_time: string;
        end_time: string;
        check_in_opens_at: string;
        check_in_closes_at: string;
        is_active: boolean;
        is_archived: boolean;
        qr_token: string;
        club_name: string;
      };
      attendanceCount: number;
      recent15m: number;
    }
  | { ok: false; reason: "not_found" | "archived" };

// Public, unauthenticated endpoint powering the /display/$qrToken TV page.
// Returns only aggregate counts + non-PII event metadata, keyed by qr_token
// (same capability the public check-in flow uses). No student rows, no ids.
export const getPublicEventDisplay = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ qrToken: qrTokenSchema }).parse(input))
  .handler(withCheckInLog("getPublicEventDisplay", async ({ data }): Promise<PublicEventDisplayPayload> => {
    await rateLimit("lookup", data.qrToken);
    const admin = await getSupabaseAdmin();
    const { data: event, error } = await admin
      .from("events")
      .select("id, event_name, event_date, start_time, end_time, check_in_opens_at, check_in_closes_at, is_active, is_archived, qr_token, clubs:club_id ( club_name )")
      .eq("qr_token", data.qrToken)
      .maybeSingle();
    if (error) throw new Error(safeMessage(error));
    if (!event) return { ok: false, reason: "not_found" };
    if (event.is_archived) return { ok: false, reason: "archived" };

    const fifteenMinAgo = new Date(Date.now() - 15 * 60_000).toISOString();
    const [{ count: attendanceCount, error: countErr }, { count: recentCount, error: recentErr }] = await Promise.all([
      admin.from("attendance_records").select("id", { count: "exact", head: true }).eq("event_id", event.id),
      admin.from("attendance_records").select("id", { count: "exact", head: true }).eq("event_id", event.id).gte("checked_in_at", fifteenMinAgo),
    ]);
    if (countErr) throw new Error(safeMessage(countErr));
    if (recentErr) throw new Error(safeMessage(recentErr));

    const clubName = Array.isArray(event.clubs)
      ? (event.clubs[0]?.club_name ?? "Club event")
      : ((event.clubs as { club_name?: string } | null)?.club_name ?? "Club event");

    return {
      ok: true,
      event: {
        event_name: event.event_name,
        event_date: event.event_date,
        start_time: event.start_time,
        end_time: event.end_time,
        check_in_opens_at: event.check_in_opens_at,
        check_in_closes_at: event.check_in_closes_at,
        is_active: event.is_active,
        is_archived: event.is_archived,
        qr_token: event.qr_token,
        club_name: clubName,
      },
      attendanceCount: attendanceCount ?? 0,
      recent15m: recentCount ?? 0,
    };
  }));



// Attendance CSV export lives in a dedicated streaming server route at
// src/routes/api.host.events.$eventId.attendance[.]csv.ts. Building the
// CSV in a server fn forced us to JSON-encode the entire payload and ship
// it back to the client as one string; the route version streams pages of
// 1000 rows directly into the response body so memory stays flat and the
// browser shows the native download dialog immediately.

// PublicStudentPreview deliberately omits the student UUID. Public responses
// must never leak primary keys — clients identify themselves on each step by
// re-supplying their 900 number (or by holding a device-session token).
function buildStudentPreview(student: { first_name: string; last_name: string; student_email: string }): PublicStudentPreview {
  return {
    firstName: student.first_name,
    lastInitial: student.last_name.charAt(0).toUpperCase(),
    maskedEmail: maskEmail(student.student_email),
  };
}

// Resolve the event for every public action by qr_token (the per-event
// capability the student physically scanned). Looking up by event UUID alone
// would mean a single one-time qr_token validation grants long-lived
// arbitrary event access — exactly the original vulnerability.
async function getEventForPublicCheckInByQr(qrToken: string) {
  const { data: event, error } = await (await getSupabaseAdmin())
    .from("events")
    .select("*")
    .eq("qr_token", qrToken)
    .maybeSingle();
  if (error) throw new Error(safeMessage(error));
  if (!event) {
    return { ok: false as const, state: "event_not_found" as const };
  }

  const status = getCheckInStatus(event);
  if (status === "upcoming") {
    return { ok: false as const, state: "not_open_yet" as const, event };
  }
  if (status === "closed" || status === "inactive" || status === "archived") {
    return { ok: false as const, state: "closed" as const, event };
  }

  return { ok: true as const, event };
}

async function getExistingAttendance(eventId: string, studentId: string) {
  const { data, error } = await (await getSupabaseAdmin())
    .from("attendance_records")
    .select("id, checked_in_at")
    .eq("event_id", eventId)
    .eq("student_id", studentId)
    .maybeSingle();

  if (error) throw new Error(safeMessage(error));
  return data;
}

// Resolve the university a student should be bound to for this event.
// Prefer the event's own university_id (kept in sync by a DB trigger), then
// fall back to the owning club's university_id. As of P1.2, students.900
// uniqueness is scoped per-university, so every check-in path REQUIRES a
// university. Callers must handle the null return by refusing the check-in
// with a clear operator-facing error rather than falling back to a global
// lookup that would silently cross university boundaries.
async function resolveEventUniversityId(event: {
  university_id: string | null;
  club_id: string;
}): Promise<string | null> {
  if (event.university_id) return event.university_id;
  const { data } = await (await getSupabaseAdmin())
    .from("clubs")
    .select("university_id")
    .eq("id", event.club_id)
    .maybeSingle();
  return data?.university_id ?? null;
}

async function requireEventUniversityId(event: {
  university_id: string | null;
  club_id: string;
}): Promise<string> {
  const universityId = await resolveEventUniversityId(event);
  if (!universityId) {
    throw new Error("Event is missing a university. Contact support.");
  }
  return universityId;
}

// Thrown when a student email's domain is not in the university's allowlist.
// The `code` mirrors the RateLimitedError pattern so the public UI can
// surface the friendly message instead of the generic transient copy.
class InvalidEmailDomainError extends Error {
  code = "invalid_email_domain" as const;
  constructor(message: string) {
    super(message);
    this.name = "InvalidEmailDomainError";
  }
}

function formatAllowedDomains(domains: string[]): string {
  const withAt = domains.map((d) => `@${d}`);
  if (withAt.length === 1) return withAt[0];
  if (withAt.length === 2) return `${withAt[0]} or ${withAt[1]}`;
  return `${withAt.slice(0, -1).join(", ")}, or ${withAt[withAt.length - 1]}`;
}

async function assertUniversityEmailAllowed(
  universityId: string,
  email: string,
): Promise<void> {
  const normalized = normalizeEmail(email);
  const atIndex = normalized.lastIndexOf("@");
  const domain = atIndex >= 0 ? normalized.slice(atIndex + 1) : "";

  const { data, error } = await (await getSupabaseAdmin())
    .from("universities")
    .select("allowed_email_domains")
    .eq("id", universityId)
    .maybeSingle();

  if (error) throw new Error(safeMessage(error, "Unable to validate email."));

  const allowed = (data?.allowed_email_domains ?? []).map((d) => d.toLowerCase());
  if (allowed.length === 0) {
    throw new Error(
      "This university has no allowed email domains configured. Contact support.",
    );
  }

  if (!domain || !allowed.includes(domain)) {
    throw new InvalidEmailDomainError(
      `Use your university email ending in ${formatAllowedDomains(allowed)}.`,
    );
  }
}

// Matches either the new per-university unique constraint or the legacy
// global one during the deploy window.
function isStudentNineHundredUniqueViolation(error: unknown): boolean {
  return (
    isUniqueViolation(error, "students_university_id_nine_hundred_number_key") ||
    isUniqueViolation(error, "students_nine_hundred_number_key")
  );
}

// Detects a Postgres unique_violation (23505). Optionally narrows to a
// specific constraint name so unrelated unique conflicts don't get mistaken
// for the one the caller is guarding against.
function isUniqueViolation(error: unknown, constraint?: string): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { code?: string; message?: string; details?: string };
  const is23505 = e.code === "23505" || /duplicate key value|unique constraint/i.test(e.message ?? "");
  if (!is23505) return false;
  if (!constraint) return true;
  const haystack = `${e.message ?? ""} ${e.details ?? ""}`;
  return haystack.includes(constraint);
}

// Best-effort activity milestone writers. Failures MUST NOT fail the caller
// (check-in / close). Unique partial indexes on host_activity ensure that
// duplicates from concurrent check-ins collapse to a single row.
async function recordCheckInMilestones(eventId: string): Promise<void> {
  try {
    const admin = await getSupabaseAdmin();
    const { data: event, error: eventError } = await admin
      .from("events")
      .select("id, club_id")
      .eq("id", eventId)
      .maybeSingle();
    if (eventError || !event) return;

    const { count, error: countError } = await admin
      .from("attendance_records")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId);
    if (countError) return;
    const attendanceCount = count ?? 0;
    if (attendanceCount < 1) return;

    // Best-effort inserts. Unique conflicts are expected under races and are
    // swallowed — that's the whole point of the partial unique indexes.
    await admin
      .from("host_activity")
      .insert({
        club_id: event.club_id,
        event_id: eventId,
        activity_type: "first_check_in",
        attendance_count: attendanceCount,
      });

    const { HOST_ACTIVITY_THRESHOLDS } = await import("@/lib/attendance-hq");
    for (const threshold of HOST_ACTIVITY_THRESHOLDS) {
      if (attendanceCount >= threshold) {
        await admin
          .from("host_activity")
          .insert({
            club_id: event.club_id,
            event_id: eventId,
            activity_type: "threshold_reached",
            threshold,
            attendance_count: attendanceCount,
          });
      }
    }
  } catch (err) {
    if (typeof console !== "undefined") {
      const e = err as { code?: string; message?: string } | null;
      console.error("[activity] recordCheckInMilestones failed", {
        code: e?.code,
        message: safeMessage(e ?? null, "unknown error"),
      });
    }
  }
}

async function recordCheckInClosed(eventId: string): Promise<void> {
  try {
    const admin = await getSupabaseAdmin();
    const { data: event, error: eventError } = await admin
      .from("events")
      .select("id, club_id")
      .eq("id", eventId)
      .maybeSingle();
    if (eventError || !event) return;

    const { count } = await admin
      .from("attendance_records")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId);

    await admin
      .from("host_activity")
      .insert({
        club_id: event.club_id,
        event_id: eventId,
        activity_type: "check_in_closed",
        attendance_count: count ?? 0,
      });
  } catch (err) {
    if (typeof console !== "undefined") {
      const e = err as { code?: string; message?: string } | null;
      console.error("[activity] recordCheckInClosed failed", {
        code: e?.code,
        message: safeMessage(e ?? null, "unknown error"),
      });
    }
  }
}

async function createAttendanceRecord(input: {
  event: { id: string };
  studentId: string;
  method: "qr_scan" | "returning_lookup" | "remembered_device";
}) {
  const existingAttendance = await getExistingAttendance(input.event.id, input.studentId);
  if (existingAttendance) {
    return {
      ok: false as const,
      state: "already_checked_in" as const,
      checkedInAt: existingAttendance.checked_in_at,
    };
  }

  const { data: attendance, error } = await (await getSupabaseAdmin())
    .from("attendance_records")
    .insert({
      event_id: input.event.id,
      student_id: input.studentId,
      check_in_method: input.method,
      check_in_source: "public_mobile",
    })
    .select("id, checked_in_at")
    .single();

  if (error) {
    // Race: another request inserted the same (event_id, student_id) between
    // the pre-check and this insert. Re-read and surface as already_checked_in
    // so the public UI can render the friendly state instead of a raw error.
    if (isUniqueViolation(error, "attendance_records_event_id_student_id_key")) {
      const raced = await getExistingAttendance(input.event.id, input.studentId);
      if (raced) {
        return {
          ok: false as const,
          state: "already_checked_in" as const,
          checkedInAt: raced.checked_in_at,
        };
      }
    }
    throw new Error(safeMessage(error, "Unable to record attendance"));
  }
  if (!attendance) throw new Error(safeMessage(null, "Unable to record attendance"));
  await recordCheckInMilestones(input.event.id);
  return { ok: true as const, attendance };
}

// First-time / unknown-student check-in.
// All public flows are keyed by qrToken so the QR capability is re-validated
// every step. The 900 number proves student identity for new registrations;
// returning students get a "this is you" handoff that requires re-confirming
// the 900 number on the next call (see confirmReturningStudent).
export const studentCheckIn = createServerFn({ method: "POST" })
  .inputValidator(studentCheckInInputSchema)
  .handler(withCheckInLog("studentCheckIn", async ({ data }) => {
    await rateLimit("register", data.qrToken);
    const eventCheck = await getEventForPublicCheckInByQr(data.qrToken);
    if (!eventCheck.ok) return eventCheck;


    const universityId = await requireEventUniversityId(eventCheck.event);

    const { data: existingStudent, error: existingStudentError } = await (await getSupabaseAdmin())
      .from("students")
      .select("id, first_name, last_name, student_email")
      .eq("nine_hundred_number", data.nineHundredNumber)
      .eq("university_id", universityId)
      .maybeSingle();

    if (existingStudentError) throw new Error(safeMessage(existingStudentError, "Unable to look up student."));

    if (existingStudent) {
      const existingAttendance = await getExistingAttendance(eventCheck.event.id, existingStudent.id);
      if (existingAttendance) {
        return {
          ok: false as const,
          state: "already_checked_in" as const,
          checkedInAt: existingAttendance.checked_in_at,
        };
      }

      // Do NOT return the student UUID. The client must re-call
      // confirmReturningStudent with the 900 number it just submitted.
      return {
        ok: false as const,
        state: "student_exists" as const,
        student: buildStudentPreview(existingStudent),
      };
    }

    await assertUniversityEmailAllowed(universityId, data.studentEmail);

    const { data: student, error: studentError } = await (await getSupabaseAdmin())
      .from("students")
      .insert({
        first_name: data.firstName.trim(),
        last_name: data.lastName.trim(),
        student_email: data.studentEmail,
        nine_hundred_number: data.nineHundredNumber,
        university_id: universityId,
      })
      .select("id, first_name, last_name, student_email")
      .single();

    if (studentError || !student) {
      // Race: a parallel first-time submission inserted the same 900 number
      // between our lookup and insert. Re-read (scoped to this university)
      // and hand off through the returning-student preview path.
      if (isStudentNineHundredUniqueViolation(studentError)) {
        const { data: raced } = await (await getSupabaseAdmin())
          .from("students")
          .select("id, first_name, last_name, student_email")
          .eq("nine_hundred_number", data.nineHundredNumber)
          .eq("university_id", universityId)
          .maybeSingle();
        if (raced) {
          const existingAttendance = await getExistingAttendance(eventCheck.event.id, raced.id);
          if (existingAttendance) {
            return {
              ok: false as const,
              state: "already_checked_in" as const,
              checkedInAt: existingAttendance.checked_in_at,
            };
          }
          return {
            ok: false as const,
            state: "student_exists" as const,
            student: buildStudentPreview(raced),
          };
        }
      }
      throw new Error(safeMessage(studentError, "Unable to save student"));
    }

    const attendanceResult = await createAttendanceRecord({
      event: eventCheck.event,
      studentId: student.id,
      method: "qr_scan",
    });

    if (!attendanceResult.ok) return attendanceResult;

    let deviceToken: string | null = null;
    if (data.rememberDevice) {
      deviceToken = createDeviceToken();
      const { error: sessionError } = await (await getSupabaseAdmin()).from("student_device_sessions").insert({
        student_id: student.id,
        device_token: deviceToken,
      });

      if (sessionError) throw new Error(safeMessage(sessionError));
    }

    return {
      ok: true as const,
      attendance: attendanceResult.attendance,
      deviceToken,
      student: buildStudentPreview(student),
    };
  }));

// Remembered-device peek. Returns ONLY the masked preview; the device token
// is the only secret the client holds, so we never echo back the student id.
export const getRememberedStudent = createServerFn({ method: "POST" })
  .inputValidator(rememberedDeviceInputSchema)
  .handler(withCheckInLog("getRememberedStudent", async ({ data }) => {
    await rateLimit("fast", data.qrToken);
    const eventCheck = await getEventForPublicCheckInByQr(data.qrToken);
    if (!eventCheck.ok) return eventCheck;



    const { data: session, error } = await (await getSupabaseAdmin())
      .from("student_device_sessions")
      .select("id, student_id, created_at, last_used_at")
      .eq("device_token", data.deviceToken)
      .maybeSingle();

    if (error) throw new Error(safeMessage(error));
    if (!session) {
      return { ok: false as const, state: "student_not_found" as const };
    }

    if (isDeviceSessionExpired(session)) {
      // Best-effort cleanup of this one stale row. Errors are ignored so a
      // transient delete failure still returns the same "unknown device"
      // state and the client falls through to first-time / returning.
      await (await getSupabaseAdmin())
        .from("student_device_sessions")
        .delete()
        .eq("id", session.id);
      return { ok: false as const, state: "student_not_found" as const };
    }

    const { data: student, error: studentError } = await (await getSupabaseAdmin())
      .from("students")
      .select("first_name, last_name, student_email")
      .eq("id", session.student_id)
      .maybeSingle();

    if (studentError) throw new Error(safeMessage(studentError));
    if (!student) {
      return { ok: false as const, state: "student_not_found" as const };
    }

    const existingAttendance = await getExistingAttendance(eventCheck.event.id, session.student_id);
    if (existingAttendance) {
      return {
        ok: false as const,
        state: "already_checked_in" as const,
        checkedInAt: existingAttendance.checked_in_at,
      };
    }

    return {
      ok: true as const,
      student: buildStudentPreview(student),
    };
  }));

// Fast-path remembered-device check-in. The server resolves the student from
// the device session — clients never tell us who they are. Pre-fix, the
// schema accepted (eventId, studentId, deviceToken) and the studentId could
// be any UUID matched to the device session, so a leaked deviceToken plus a
// guessable studentId was enough to check anyone in.
export const fastCheckIn = createServerFn({ method: "POST" })
  .inputValidator(fastCheckInSchema)
  .handler(withCheckInLog("fastCheckIn", async ({ data }) => {
    await rateLimit("fast", data.qrToken);
    const eventCheck = await getEventForPublicCheckInByQr(data.qrToken);
    if (!eventCheck.ok) return eventCheck;


    const { data: session, error: sessionError } = await (await getSupabaseAdmin())
      .from("student_device_sessions")
      .select("id, student_id, created_at, last_used_at")
      .eq("device_token", data.deviceToken)
      .maybeSingle();

    if (sessionError) throw new Error(safeMessage(sessionError));
    if (!session) {
      return { ok: false as const, state: "student_not_found" as const };
    }

    if (isDeviceSessionExpired(session)) {
      await (await getSupabaseAdmin())
        .from("student_device_sessions")
        .delete()
        .eq("id", session.id);
      return { ok: false as const, state: "student_not_found" as const };
    }

    const attendanceResult = await createAttendanceRecord({
      event: eventCheck.event,
      studentId: session.student_id,
      method: "remembered_device",
    });

    if (!attendanceResult.ok) return attendanceResult;

    await (await getSupabaseAdmin()).from("student_device_sessions").update({ last_used_at: new Date().toISOString() }).eq("id", session.id);

    return { ok: true as const, attendance: attendanceResult.attendance };
  }));

// Returning-student check-in. Pre-fix, this took (eventId, studentId) with
// NO identity proof at all — once you knew any student UUID + any event UUID
// you could mark that student present anywhere. The fix:
//   • input is keyed on (qrToken, nineHundredNumber)
//   • the server re-resolves the event from qrToken
//   • the server re-resolves the student from the 900 number that was just
//     typed in for the lookup step
// So the client cannot inject an arbitrary student id at confirm time.
export const confirmReturningStudent = createServerFn({ method: "POST" })
  .inputValidator(confirmReturningInputSchema)
  .handler(withCheckInLog("confirmReturningStudent", async ({ data }) => {
    await rateLimit("register", data.qrToken);
    const eventCheck = await getEventForPublicCheckInByQr(data.qrToken);
    if (!eventCheck.ok) return eventCheck;

    const universityId = await requireEventUniversityId(eventCheck.event);
    const { data: student, error } = await (await getSupabaseAdmin())
      .from("students")
      .select("id")
      .eq("nine_hundred_number", data.nineHundredNumber)
      .eq("university_id", universityId)
      .maybeSingle();

    if (error) throw new Error(safeMessage(error));
    if (!student) {
      return { ok: false as const, state: "student_not_found" as const };
    }

    const attendanceResult = await createAttendanceRecord({
      event: eventCheck.event,
      studentId: student.id,
      method: "returning_lookup",
    });

    if (!attendanceResult.ok) return attendanceResult;
    return { ok: true as const, attendance: attendanceResult.attendance };
  }));

// Returning-student lookup. Pre-fix, this returned the raw student UUID and
// took eventId; the client could then post that UUID to confirmReturningStudent
// to mark the student present. The fix removes the UUID from the response —
// it returns only the masked preview ("Sam P. — sam****@…") that lets the
// student visually confirm before the next call.
export const lookupStudent = createServerFn({ method: "POST" })
  .inputValidator(returningLookupInputSchema)
  .handler(withCheckInLog("lookupStudent", async ({ data }) => {
    await rateLimit("lookup", data.qrToken);
    const eventCheck = await getEventForPublicCheckInByQr(data.qrToken);
    if (!eventCheck.ok) return eventCheck;

    const universityId = await requireEventUniversityId(eventCheck.event);
    const { data: student, error } = await (await getSupabaseAdmin())
      .from("students")
      .select("id, first_name, last_name, student_email")
      .eq("nine_hundred_number", data.nineHundredNumber)
      .eq("university_id", universityId)
      .maybeSingle();

    if (error) throw new Error(safeMessage(error));
    if (!student) {
      return { ok: false as const, state: "student_not_found" as const };
    }

    const existingAttendance = await getExistingAttendance(eventCheck.event.id, student.id);
    if (existingAttendance) {
      return {
        ok: false as const,
        state: "already_checked_in" as const,
        checkedInAt: existingAttendance.checked_in_at,
      };
    }

    return {
      ok: true as const,
      student: buildStudentPreview(student),
    };
  }));

export const removeAttendance = createServerFn({ method: "POST" })
  .middleware([requireHostActive])
  .inputValidator(removeAttendanceSchema)
  .handler(async ({ data, context }) => {
    // 1. Verify the host owns the event the attendance is being removed from.
    //    Pre-fix, ANY authenticated host could delete ANY attendance row by
    //    posting its UUID — the function went straight to the admin client
    //    with no ownership check.
    await requireOwnedEvent(context.supabase, context.userId, data.eventId);

    const admin = await getSupabaseAdmin();

    // 2. Verify the attendance record actually belongs to THIS event so a
    //    host can't delete attendance from a different (also-owned or not)
    //    event by sending a mismatched (eventId, attendanceRecordId) pair.
    const { data: record, error: lookupError } = await admin
      .from("attendance_records")
      .select("id, event_id, student_id, checked_in_at, students(id, first_name, last_name, student_email, nine_hundred_number)")
      .eq("id", data.attendanceRecordId)
      .maybeSingle();

    if (lookupError) throw new Error(safeMessage(lookupError));
    if (!record || record.event_id !== data.eventId || !record.students) throw notFound();

    // Audit row MUST be written before the delete: attendance_actions has
    // attendance_record_id REFERENCES attendance_records(id) ON DELETE SET
    // NULL — the FK is checked at insert time, so inserting after the delete
    // would fail. After the delete fires, ON DELETE SET NULL nulls the FK on
    // the audit row, preserving the audit log.
    const { error: actionError } = await admin.from("attendance_actions").insert({
      event_id: data.eventId,
      attendance_record_id: data.attendanceRecordId,
      host_id: context.userId,
      action_type: "removed",
      notes: buildAttendanceActionNotes({
        kind: "removed",
        studentId: record.student_id,
        firstName: record.students.first_name,
        lastName: record.students.last_name,
        studentEmail: record.students.student_email,
        nineHundredNumber: record.students.nine_hundred_number,
        checkedInAt: record.checked_in_at,
        attendanceRecordId: record.id,
      }),
    });
    if (actionError) throw new Error(safeMessage(actionError, "Unable to record action."));

    const { error: deleteError } = await admin
      .from("attendance_records")
      .delete()
      .eq("id", data.attendanceRecordId);
    if (deleteError) throw new Error(safeMessage(deleteError, "Unable to remove attendance."));

    return { ok: true };
  });

export const manualCheckIn = createServerFn({ method: "POST" })
  .middleware([requireHostActive])
  .inputValidator(manualAttendanceSchema)
  .handler(async ({ data, context }) => {
    const event = await requireOwnedEvent(context.supabase, context.userId, data.eventId);
    const admin = await getSupabaseAdmin();

    const universityId = await requireEventUniversityId(event);

    await assertUniversityEmailAllowed(universityId, data.studentEmail);


    let student: AttendanceActionStudentSnapshot | null = null;
    const { data: existingStudent, error: existingStudentError } = await admin
      .from("students")
      .select("id, first_name, last_name, student_email, nine_hundred_number, university_id")
      .eq("nine_hundred_number", data.nineHundredNumber)
      .eq("university_id", universityId)
      .maybeSingle();

    if (existingStudentError) throw new Error(safeMessage(existingStudentError, "Unable to look up student."));

    if (existingStudent) {
      const { data: updatedStudent, error: updatedStudentError } = await admin
        .from("students")
        .update({
          first_name: data.firstName.trim(),
          last_name: data.lastName.trim(),
          student_email: data.studentEmail,
        })
        .eq("id", existingStudent.id)
        .select("id, first_name, last_name, student_email, nine_hundred_number")
        .single();
      if (updatedStudentError || !updatedStudent) throw new Error(safeMessage(updatedStudentError, "Unable to update student."));
      student = updatedStudent as AttendanceActionStudentSnapshot;
    } else {
      const { data: createdStudent, error: createdStudentError } = await admin
        .from("students")
        .insert({
          first_name: data.firstName.trim(),
          last_name: data.lastName.trim(),
          student_email: data.studentEmail,
          nine_hundred_number: data.nineHundredNumber,
          university_id: universityId,
        })
        .select("id, first_name, last_name, student_email, nine_hundred_number")
        .single();
      if (createdStudentError || !createdStudent) {
        // Race: parallel manual/public submit inserted the same 900 number
        // for this university between our lookup and insert. Re-read (scoped
        // to this university) and continue through the update path.
        if (isStudentNineHundredUniqueViolation(createdStudentError)) {
          const { data: raced, error: racedError } = await admin
            .from("students")
            .select("id, first_name, last_name, student_email, nine_hundred_number, university_id")
            .eq("nine_hundred_number", data.nineHundredNumber)
            .eq("university_id", universityId)
            .maybeSingle();
          if (racedError) throw new Error(safeMessage(racedError, "Unable to look up student."));
          if (raced) {
            const { data: updatedStudent, error: updatedStudentError } = await admin
              .from("students")
              .update({
                first_name: data.firstName.trim(),
                last_name: data.lastName.trim(),
                student_email: data.studentEmail,
              })
              .eq("id", raced.id)
              .select("id, first_name, last_name, student_email, nine_hundred_number")
              .single();
            if (updatedStudentError || !updatedStudent) throw new Error(safeMessage(updatedStudentError, "Unable to update student."));
            student = updatedStudent as AttendanceActionStudentSnapshot;
          } else {
            throw new Error(safeMessage(createdStudentError, "Unable to save student."));
          }
        } else {
          throw new Error(safeMessage(createdStudentError, "Unable to save student."));
        }
      } else {
        student = createdStudent as AttendanceActionStudentSnapshot;
      }
    }


    const existingAttendance = await getExistingAttendance(event.id, student.id);
    if (existingAttendance) throw new Error("This student is already checked in.");

    const { data: attendance, error: attendanceError } = await admin
      .from("attendance_records")
      .insert({
        event_id: event.id,
        student_id: student.id,
        check_in_method: "host_correction",
        check_in_source: "host_dashboard",
      })
      .select("id, checked_in_at")
      .single();
    if (attendanceError || !attendance) {
      // Race: another check-in landed for (event_id, student_id) between the
      // pre-check and this insert. Surface the same friendly message the
      // pre-check uses instead of a raw Postgres error.
      if (isUniqueViolation(attendanceError, "attendance_records_event_id_student_id_key")) {
        throw new Error("This student is already checked in.");
      }
      throw new Error(safeMessage(attendanceError, "Unable to save attendance."));
    }

    const { error: actionError } = await admin.from("attendance_actions").insert({
      event_id: event.id,
      attendance_record_id: attendance.id,
      host_id: context.userId,
      action_type: "note",
      notes: buildAttendanceActionNotes({
        kind: "manual_check_in",
        studentId: student.id,
        firstName: student.first_name,
        lastName: student.last_name,
        studentEmail: student.student_email,
        nineHundredNumber: student.nine_hundred_number,
        checkedInAt: attendance.checked_in_at,
        attendanceRecordId: attendance.id,
      }),
    });
    if (actionError) throw new Error(safeMessage(actionError, "Unable to record action."));

    await recordCheckInMilestones(event.id);
    return { ok: true };
  });

export const restoreAttendance = createServerFn({ method: "POST" })
  .middleware([requireHostActive])
  .inputValidator(restoreAttendanceSchema)
  .handler(async ({ data, context }) => {
    const event = await requireOwnedEvent(context.supabase, context.userId, data.eventId);
    const admin = await getSupabaseAdmin();
    const { data: student, error: studentError } = await admin
      .from("students")
      .select("id, first_name, last_name, student_email, nine_hundred_number")
      .eq("id", data.studentId)
      .maybeSingle();

    if (studentError) throw new Error(safeMessage(studentError, "Unable to look up student."));
    if (!student) throw notFound();

    const existingAttendance = await getExistingAttendance(event.id, student.id);
    if (existingAttendance) throw new Error("This student is already checked in.");

    const { data: attendance, error: attendanceError } = await admin
      .from("attendance_records")
      .insert({
        event_id: event.id,
        student_id: student.id,
        check_in_method: "host_correction",
        check_in_source: "host_dashboard",
      })
      .select("id, checked_in_at")
      .single();
    if (attendanceError || !attendance) throw new Error(safeMessage(attendanceError, "Unable to restore attendance."));

    const { error: actionError } = await admin.from("attendance_actions").insert({
      event_id: event.id,
      attendance_record_id: attendance.id,
      host_id: context.userId,
      action_type: "restored",
      notes: buildAttendanceActionNotes({
        kind: "restored",
        studentId: student.id,
        firstName: student.first_name,
        lastName: student.last_name,
        studentEmail: student.student_email,
        nineHundredNumber: student.nine_hundred_number,
        checkedInAt: attendance.checked_in_at,
        attendanceRecordId: attendance.id,
      }),
    });
    if (actionError) throw new Error(safeMessage(actionError, "Unable to record action."));

    return { ok: true };
  });


export const correctStudentProfile = createServerFn({ method: "POST" })
  .middleware([requireHostActive])
  .inputValidator(correctStudentProfileSchema)
  .handler(async ({ data, context }) => {
    const event = await requireOwnedEvent(context.supabase, context.userId, data.eventId);
    const admin = await getSupabaseAdmin();

    // Load the student (identity-key fields stay put).
    const { data: student, error: studentError } = await admin
      .from("students")
      .select("id, nine_hundred_number, university_id")
      .eq("id", data.studentId)
      .maybeSingle();
    if (studentError) throw new Error(safeMessage(studentError, "Unable to look up student."));
    if (!student) throw notFound();

    // Roster gate: student must already be on this event's roster.
    const { data: rosterRow, error: rosterError } = await admin
      .from("attendance_records")
      .select("id")
      .eq("event_id", event.id)
      .eq("student_id", student.id)
      .maybeSingle();
    if (rosterError) throw new Error(safeMessage(rosterError, "Unable to verify roster."));
    if (!rosterRow) throw new Error("Student is not on this event's roster.");

    // Domain gate (P1.3) against event's university.
    const universityId = await requireEventUniversityId(event);
    await assertUniversityEmailAllowed(universityId, data.studentEmail);

    // Update name/email only. Never touch nine_hundred_number or university_id.
    const { data: updated, error: updateError } = await admin
      .from("students")
      .update({
        first_name: data.firstName.trim(),
        last_name: data.lastName.trim(),
        student_email: data.studentEmail,
      })
      .eq("id", student.id)
      .select("id, first_name, last_name, student_email, nine_hundred_number")
      .single();
    if (updateError || !updated) throw new Error(safeMessage(updateError, "Unable to update student."));

    const { error: actionError } = await admin.from("attendance_actions").insert({
      event_id: event.id,
      attendance_record_id: rosterRow.id,
      host_id: context.userId,
      action_type: "note",
      notes: buildAttendanceActionNotes({
        kind: "profile_corrected",
        studentId: updated.id,
        firstName: updated.first_name,
        lastName: updated.last_name,
        studentEmail: updated.student_email,
        nineHundredNumber: updated.nine_hundred_number,
        attendanceRecordId: rosterRow.id,
      }),
    });
    if (actionError) throw new Error(safeMessage(actionError, "Unable to record action."));

    return { ok: true, student: updated as AttendanceActionStudentSnapshot };
  });

export const toggleEventArchive = createServerFn({ method: "POST" })
  .middleware([requireHostActive])
  .inputValidator(toggleEventArchiveSchema)
  .handler(async ({ data, context }) => {
    await requireOwnedEvent(context.supabase, context.userId, data.eventId);

    const { error } = await (await getSupabaseAdmin())
      .from("events")
      .update({
        is_archived: data.isArchived,
        is_active: data.isArchived ? false : true,
      })
      .eq("id", data.eventId);
    if (error) throw new Error(safeMessage(error, data.isArchived ? "Unable to archive event." : "Unable to reopen event."));
    return { ok: true };
  });

export const closeCheckInEarly = createServerFn({ method: "POST" })
  .middleware([requireHostActive])
  .inputValidator(closeCheckInEarlySchema)
  .handler(async ({ data, context }) => {
    // Pre-fix, this function would close (deactivate + clamp window on)
    // ANY event by id with no ownership check at all. Now we require the
    // caller to own the event.
    await requireOwnedEvent(context.supabase, context.userId, data.eventId);

    const { error } = await (await getSupabaseAdmin())
      .from("events")
      .update({ is_active: false, check_in_closes_at: new Date().toISOString() })
      .eq("id", data.eventId);
    if (error) throw new Error(safeMessage(error));
    await recordCheckInClosed(data.eventId);
    return { ok: true };
  });

export const regenerateEventQrToken = createServerFn({ method: "POST" })
  .middleware([requireHostActive])
  .inputValidator(regenerateEventQrTokenSchema)
  .handler(async ({ data, context }) => {
    await requireOwnedEvent(context.supabase, context.userId, data.eventId);

    const admin = await getSupabaseAdmin();

    // qr_token has a UNIQUE constraint. Retry once on the rare collision.
    let lastError: { message?: string; code?: string; details?: string; status?: number } | null = null;
    let newToken: string | null = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      const candidate = createQrToken();
      const { data: updated, error } = await admin
        .from("events")
        .update({ qr_token: candidate, updated_at: new Date().toISOString() })
        .eq("id", data.eventId)
        .select("qr_token")
        .single();
      if (!error && updated) {
        newToken = updated.qr_token;
        break;
      }
      lastError = error;
      // 23505 = unique violation. Any other error, stop.
      if (!error || error.code !== "23505") break;
    }
    if (!newToken) {
      throw new Error(safeMessage(lastError, "Unable to regenerate QR token."));
    }

    // Best-effort audit note. Failure here shouldn't roll back the rotation.
    await admin.from("attendance_actions").insert({
      event_id: data.eventId,
      host_id: context.userId,
      attendance_record_id: null,
      action_type: "note",
      notes: buildAttendanceActionNotes({ kind: "qr_token_regenerated" }),
    });

    return { ok: true, qrToken: newToken };
  });

// Cascade-delete a single event. Because the schema has no FK cascade
// declarations, we have to remove attendance actions + records first,
// then the event row itself. Ownership is re-verified via
// requireOwnedEvent; RLS is a secondary guard on each write.
async function cascadeDeleteEvent(supabase: AppSupabaseClient, eventId: string) {
  const admin = await getSupabaseAdmin();

  const { error: actionsError } = await admin
    .from("attendance_actions")
    .delete()
    .eq("event_id", eventId);
  if (actionsError) throw new Error(safeMessage(actionsError, "Unable to delete event history."));

  const { error: recordsError } = await admin
    .from("attendance_records")
    .delete()
    .eq("event_id", eventId);
  if (recordsError) throw new Error(safeMessage(recordsError, "Unable to delete attendance records."));

  const { error: eventError } = await admin
    .from("events")
    .delete()
    .eq("id", eventId);
  if (eventError) throw new Error(safeMessage(eventError, "Unable to delete event."));
}

export const deleteEvent = createServerFn({ method: "POST" })
  .middleware([requireHostActive])
  .inputValidator(deleteEventSchema)
  .handler(async ({ data, context }) => {
    await requireOwnedEvent(context.supabase, context.userId, data.eventId);

    // Guard: preserve semester evidence. Events with any check-in history
    // can't be hard-deleted — hosts must archive them via toggleEventArchive.
    const admin = await getSupabaseAdmin();
    const { count, error: countError } = await admin
      .from("attendance_records")
      .select("id", { count: "exact", head: true })
      .eq("event_id", data.eventId);
    if (countError) throw new Error(safeMessage(countError, "Unable to check event history."));
    if ((count ?? 0) > 0) {
      throw new Error("This event has check-in records and can't be deleted. Archive it instead.");
    }

    await cascadeDeleteEvent(context.supabase, data.eventId);
    return { ok: true };
  });

export const deleteClub = createServerFn({ method: "POST" })
  .middleware([requireHostActive])
  .inputValidator(deleteClubSchema)
  .handler(async ({ data, context }) => {
    await requireClubOwner(context.supabase, context.userId, data.clubId);

    const admin = await getSupabaseAdmin();

    // Guard: block hard-delete when the club still has events. Any events
    // with attendance would destroy semester evidence; empty events must
    // also be removed/archived first so the host makes an explicit choice.
    const { data: events, error: eventsError } = await admin
      .from("events")
      .select("id")
      .eq("club_id", data.clubId);
    if (eventsError) throw new Error(safeMessage(eventsError, "Unable to load club events."));

    if ((events?.length ?? 0) > 0) {
      const eventIds = events!.map((e) => e.id);
      const { count: attendanceCount, error: attendanceCountError } = await admin
        .from("attendance_records")
        .select("id", { count: "exact", head: true })
        .in("event_id", eventIds);
      if (attendanceCountError) {
        throw new Error(safeMessage(attendanceCountError, "Unable to check club history."));
      }
      if ((attendanceCount ?? 0) > 0) {
        throw new Error(
          "This club has check-in history and can't be deleted. Archive its events instead.",
        );
      }
      throw new Error("Remove or archive all events in this club before deleting it.");
    }


    // 2. Remove event templates attached to this club.
    const { error: templatesError } = await admin
      .from("event_templates")
      .delete()
      .eq("club_id", data.clubId);
    if (templatesError) throw new Error(safeMessage(templatesError, "Unable to delete club templates."));

    // 3. Finally, delete the club row itself.
    const { error: clubError } = await admin
      .from("clubs")
      .delete()
      .eq("id", data.clubId);
    if (clubError) throw new Error(safeMessage(clubError, "Unable to delete club."));

    return { ok: true };
  });

// ─────────────────────────────────────────────────────────────────────────────
// Semester attendance report (club-scoped, read-only).
// A student × meeting matrix over a date range. Hosts of the club see the
// matrix inline and can hit the streaming CSV route for the un-capped export.
// Authz: requireClubAccess — owner/officer of that specific club only. RLS
// still applies to every query below; the gate is defense-in-depth.
// ─────────────────────────────────────────────────────────────────────────────
export const getClubAttendanceReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(clubAttendanceReportSchema)
  .handler(async ({ data, context }) => {
    const club = await requireClubAccess(context.supabase, context.userId, data.clubId);

    const defaults = getDefaultClubReportRange();
    const fromDate = data.fromDate && data.fromDate.length ? data.fromDate : defaults.fromDate;
    const toDate = data.toDate && data.toDate.length ? data.toDate : defaults.toDate;

    // Events in range — include archived, so hosts see who missed every
    // meeting even if the row was later archived.
    const { data: eventsRaw, error: eventsError } = await context.supabase
      .from("events")
      .select("id, event_name, event_date, start_time")
      .eq("club_id", club.id)
      .gte("event_date", fromDate)
      .lte("event_date", toDate)
      .order("event_date", { ascending: true })
      .order("start_time", { ascending: true });
    if (eventsError) throw new Error(safeMessage(eventsError, "Unable to load events."));

    let events = (eventsRaw ?? []) as { id: string; event_name: string; event_date: string; start_time: string }[];
    let truncated = false;
    if (events.length > CLUB_REPORT_MAX_EVENTS) {
      events = events.slice(0, CLUB_REPORT_MAX_EVENTS);
      truncated = true;
    }
    const eventIds = events.map((e) => e.id);

    type StudentEntry = ClubAttendanceReportStudent;
    const studentsMap = new Map<string, StudentEntry>();

    if (eventIds.length) {
      const PAGE = 1000;
      let offset = 0;
      for (;;) {
        const { data: rows, error } = await context.supabase
          .from("attendance_records")
          .select(
            "event_id, checked_in_at, students(id, first_name, last_name, student_email, nine_hundred_number)",
          )
          .in("event_id", eventIds)
          .order("checked_in_at", { ascending: true })
          .range(offset, offset + PAGE - 1);
        if (error) throw new Error(safeMessage(error, "Unable to load attendance."));

        const page = (rows ?? []) as Array<{
          event_id: string;
          checked_in_at: string;
          students: {
            id: string;
            first_name: string;
            last_name: string;
            student_email: string;
            nine_hundred_number: string | null;
          } | null;
        }>;
        for (const row of page) {
          const s = row.students;
          if (!s) continue;
          let entry = studentsMap.get(s.id);
          if (!entry) {
            entry = {
              studentId: s.id,
              firstName: s.first_name,
              lastName: s.last_name,
              studentEmail: s.student_email,
              nineHundredNumber: s.nine_hundred_number ?? "",
              totalCheckIns: 0,
              attendanceByEventId: Object.fromEntries(eventIds.map((id) => [id, null])),
            };
            studentsMap.set(s.id, entry);
          }
          // First check-in wins (ordered ASC), so re-check-ins after a
          // remove/restore don't overwrite the earliest timestamp.
          if (!entry.attendanceByEventId[row.event_id]) {
            entry.attendanceByEventId[row.event_id] = row.checked_in_at;
            entry.totalCheckIns += 1;
          }
        }
        if (page.length < PAGE) break;
        offset += PAGE;
      }
    }

    let students = Array.from(studentsMap.values()).sort((a, b) => {
      const ln = a.lastName.localeCompare(b.lastName);
      if (ln !== 0) return ln;
      return a.firstName.localeCompare(b.firstName);
    });
    if (students.length > CLUB_REPORT_MAX_STUDENTS) {
      students = students.slice(0, CLUB_REPORT_MAX_STUDENTS);
      truncated = true;
    }

    const totalCheckIns = students.reduce((sum, s) => sum + s.totalCheckIns, 0);

    const payload: ClubAttendanceReportPayload = {
      club: { id: club.id, club_name: club.club_name },
      fromDate,
      toDate,
      events: events.map((e) => ({ id: e.id, eventName: e.event_name, eventDate: e.event_date })),
      students,
      summary: { eventCount: events.length, studentCount: students.length, totalCheckIns },
      truncated,
    };
    return payload;
  });

// Host activity feed. RLS on host_activity restricts SELECT to club members,
// so using the caller-scoped supabase client is enough — no explicit
// membership filter needed here.
export const getHostActivity = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<HostActivityEntry[]> => {
    const { data, error } = await context.supabase
      .from("host_activity")
      .select(
        "id, activity_type, threshold, attendance_count, created_at, event_id, club_id, events!inner(id, event_name, event_date), clubs!inner(id, club_name)",
      )
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(safeMessage(error, "Unable to load activity."));
    const rows = (data ?? []) as unknown as Array<{
      id: string;
      activity_type: HostActivityType;
      threshold: number | null;
      attendance_count: number | null;
      created_at: string;
      events: { id: string; event_name: string; event_date: string } | null;
      clubs: { id: string; club_name: string } | null;
    }>;
    return rows
      .filter((r) => r.events && r.clubs)
      .map((r) => ({
        id: r.id,
        activityType: r.activity_type,
        threshold: r.threshold,
        attendanceCount: r.attendance_count,
        createdAt: r.created_at,
        event: { id: r.events!.id, eventName: r.events!.event_name, eventDate: r.events!.event_date },
        club: { id: r.clubs!.id, clubName: r.clubs!.club_name },
      }));
  });

// ─────────────────────────────────────────────────────────────────────────────
// Retention purge (club owner only). Deletes attendance history + actions for
// events in a club whose event_date is strictly before `beforeDate`. Leaves
// events, templates, clubs, students, and device sessions intact — students
// are university-scoped and may attend other clubs; only the CLUB'S copy of
// their attendance is removed. Guarded by exact club name confirmation +
// retention-cutoff bound so hosts can't accidentally wipe recent data.
// ─────────────────────────────────────────────────────────────────────────────
export const purgeClubAttendanceOlderThan = createServerFn({ method: "POST" })
  .middleware([requireHostActive])
  .inputValidator(purgeClubAttendanceSchema)
  .handler(async ({ data, context }) => {
    const club = await requireClubOwner(context.supabase, context.userId, data.clubId);

    // Confirmation phrase must match the club name exactly (trimmed). Cheap
    // defense against tap-through mistakes.
    if (data.confirmClubName.trim() !== club.club_name.trim()) {
      throw new Error("Club name confirmation did not match.");
    }

    // beforeDate cannot be inside the retention window — only data older
    // than the policy is eligible for purge.
    const cutoff = getAttendanceRetentionCutoffDate();
    if (data.beforeDate > cutoff) {
      throw new Error(
        `You can only delete attendance older than the retention cutoff (${cutoff}).`,
      );
    }

    const admin = await getSupabaseAdmin();

    // 1. Find eligible events.
    const { data: eventsRaw, error: eventsError } = await admin
      .from("events")
      .select("id")
      .eq("club_id", data.clubId)
      .lt("event_date", data.beforeDate);
    if (eventsError) throw new Error(safeMessage(eventsError, "Unable to load events for purge."));

    const eventIds = (eventsRaw ?? []).map((e) => e.id);
    if (!eventIds.length) {
      return {
        ok: true,
        eventsTouched: 0,
        attendanceDeleted: 0,
        actionsDeleted: 0,
        beforeDate: data.beforeDate,
      };
    }

    // 2. Count actions + records for logging.
    const { count: actionsCount } = await admin
      .from("attendance_actions")
      .select("id", { count: "exact", head: true })
      .in("event_id", eventIds);
    const { count: recordsCount } = await admin
      .from("attendance_records")
      .select("id", { count: "exact", head: true })
      .in("event_id", eventIds);

    // 3. Delete in FK-safe order: actions → records → activity.
    const { error: actionsError } = await admin
      .from("attendance_actions")
      .delete()
      .in("event_id", eventIds);
    if (actionsError) throw new Error(safeMessage(actionsError, "Unable to purge attendance actions."));

    const { error: recordsError } = await admin
      .from("attendance_records")
      .delete()
      .in("event_id", eventIds);
    if (recordsError) throw new Error(safeMessage(recordsError, "Unable to purge attendance records."));

    // host_activity references events too; drop the milestone rows for those
    // events so we don't leave orphan "first check-in" notices pointing at an
    // event that has zero attendance.
    await admin.from("host_activity").delete().in("event_id", eventIds);

    // Counts-only log — never emails, 900s, or student names.
    // eslint-disable-next-line no-console
    console.info("[purgeClubAttendance]", {
      clubId: data.clubId,
      beforeDate: data.beforeDate,
      eventsTouched: eventIds.length,
      attendanceDeleted: recordsCount ?? 0,
      actionsDeleted: actionsCount ?? 0,
    });

    return {
      ok: true,
      eventsTouched: eventIds.length,
      attendanceDeleted: recordsCount ?? 0,
      actionsDeleted: actionsCount ?? 0,
      beforeDate: data.beforeDate,
    };
  });


// ─────────────────────────────────────────────────────────────────────────────
// Pre-event check-in ("early head count")
//
// Fully additive surface. Everything is keyed off the event's separate
// `pre_check_in_token`, so a marketing link can be shared publicly weeks in
// advance without exposing the day-of QR token. Rows land in `pre_check_ins`
// and never touch attendance_records, so real attendance stays untouched.
// ─────────────────────────────────────────────────────────────────────────────

type PreCheckInBlockedState = "invalid_link" | "not_open_yet" | "closed" | "already_pre_checked_in";

async function getEventForPreCheckIn(preToken: string) {
  const { data: event, error } = await (await getSupabaseAdmin())
    .from("events")
    .select("*, clubs(id, club_name, club_slug, description)")
    .eq("pre_check_in_token", preToken)
    .maybeSingle();
  if (error) throw new Error(safeMessage(error));
  if (!event) return { ok: false as const, state: "invalid_link" as const };

  const status = getPreCheckInStatus(event);
  if (status === "disabled") return { ok: false as const, state: "invalid_link" as const };
  if (status === "upcoming") return { ok: false as const, state: "not_open_yet" as const, event };
  if (status === "closed") return { ok: false as const, state: "closed" as const, event };
  return { ok: true as const, event };
}

function toPublicPreCheckInEvent(event: Record<string, unknown>) {
  const clubs = event.clubs as { club_name?: string } | { club_name?: string }[] | null;
  const clubName = Array.isArray(clubs) ? (clubs[0]?.club_name ?? "Club event") : (clubs?.club_name ?? "Club event");
  return {
    event_name: event.event_name as string,
    event_date: event.event_date as string,
    start_time: event.start_time as string,
    end_time: event.end_time as string,
    location: (event.location as string | null) ?? null,
    check_in_opens_at: event.check_in_opens_at as string,
    check_in_closes_at: event.check_in_closes_at as string,
    pre_check_in_opens_at: (event.pre_check_in_opens_at as string | null) ?? null,
    pre_check_in_closes_at: (event.pre_check_in_closes_at as string | null) ?? null,
    club_name: clubName,
  };
}

/** Public: resolve the marketing link into event info + current head count. */
export const getPublicPreCheckInEvent = createServerFn({ method: "GET" })
  .inputValidator(preCheckInTokenInputSchema)
  .handler(async ({ data }) => {
    const resolved = await getEventForPreCheckIn(data.preToken);
    if (!resolved.ok && !("event" in resolved)) {
      return { ok: false as const, state: resolved.state as PreCheckInBlockedState };
    }

    const event = (resolved as { event: Record<string, unknown> }).event;
    const { count } = await (await getSupabaseAdmin())
      .from("pre_check_ins")
      .select("id", { count: "exact", head: true })
      .eq("event_id", event.id as string);

    return {
      ok: resolved.ok,
      state: resolved.ok ? ("open" as const) : (resolved.state as PreCheckInBlockedState),
      event: toPublicPreCheckInEvent(event),
      preCheckInCount: count ?? 0,
    };
  });

async function insertPreCheckIn(input: {
  eventId: string;
  studentId: string;
  method: "qr_scan" | "returning_lookup" | "remembered_device";
}) {
  const admin = await getSupabaseAdmin();
  const { data: existing } = await admin
    .from("pre_check_ins")
    .select("id, checked_in_at")
    .eq("event_id", input.eventId)
    .eq("student_id", input.studentId)
    .maybeSingle();
  if (existing) {
    return { ok: false as const, state: "already_pre_checked_in" as const, checkedInAt: existing.checked_in_at };
  }

  const { data: inserted, error } = await admin
    .from("pre_check_ins")
    .insert({ event_id: input.eventId, student_id: input.studentId, check_in_method: input.method })
    .select("id, checked_in_at")
    .single();

  if (error) {
    // Race with a parallel tap from the same student.
    if (isUniqueViolation(error, "pre_check_ins_event_id_student_id_key")) {
      const { data: raced } = await admin
        .from("pre_check_ins")
        .select("id, checked_in_at")
        .eq("event_id", input.eventId)
        .eq("student_id", input.studentId)
        .maybeSingle();
      if (raced) {
        return { ok: false as const, state: "already_pre_checked_in" as const, checkedInAt: raced.checked_in_at };
      }
    }
    throw new Error(safeMessage(error, "Unable to record early check-in"));
  }
  if (!inserted) throw new Error(safeMessage(null, "Unable to record early check-in"));
  return { ok: true as const, preCheckIn: inserted };
}

/** Public: first-time (or unknown-to-this-device) early check-in. */
export const submitPreCheckIn = createServerFn({ method: "POST" })
  .inputValidator(preCheckInRegistrationInputSchema)
  .handler(async ({ data }) => {
    await rateLimit("register", data.preToken);
    const resolved = await getEventForPreCheckIn(data.preToken);
    if (!resolved.ok) {
      return { ok: false as const, state: resolved.state as PreCheckInBlockedState };
    }

    const admin = await getSupabaseAdmin();
    const universityId = await requireEventUniversityId(resolved.event);

    const { data: existingStudent, error: existingError } = await admin
      .from("students")
      .select("id, first_name, last_name, student_email")
      .eq("nine_hundred_number", data.nineHundredNumber)
      .eq("university_id", universityId)
      .maybeSingle();
    if (existingError) throw new Error(safeMessage(existingError, "Unable to look up student."));

    let studentId = existingStudent?.id ?? null;
    let studentRow = existingStudent ?? null;

    if (!studentId) {
      await assertUniversityEmailAllowed(universityId, data.studentEmail);
      const { data: student, error: studentError } = await admin
        .from("students")
        .insert({
          first_name: data.firstName.trim(),
          last_name: data.lastName.trim(),
          student_email: data.studentEmail,
          nine_hundred_number: data.nineHundredNumber,
          university_id: universityId,
        })
        .select("id, first_name, last_name, student_email")
        .single();

      if (studentError || !student) {
        if (isStudentNineHundredUniqueViolation(studentError)) {
          const { data: raced } = await admin
            .from("students")
            .select("id, first_name, last_name, student_email")
            .eq("nine_hundred_number", data.nineHundredNumber)
            .eq("university_id", universityId)
            .maybeSingle();
          if (raced) {
            studentId = raced.id;
            studentRow = raced;
          }
        }
        if (!studentId) throw new Error(safeMessage(studentError, "Unable to save student"));
      } else {
        studentId = student.id;
        studentRow = student;
      }
    }

    const result = await insertPreCheckIn({
      eventId: resolved.event.id,
      studentId: studentId!,
      method: existingStudent ? "returning_lookup" : "qr_scan",
    });
    if (!result.ok) {
      return { ok: false as const, state: result.state, checkedInAt: result.checkedInAt };
    }

    let deviceToken: string | null = null;
    if (data.rememberDevice) {
      deviceToken = createDeviceToken();
      const { error: sessionError } = await admin
        .from("student_device_sessions")
        .insert({ student_id: studentId!, device_token: deviceToken });
      if (sessionError) deviceToken = null;
    }

    return {
      ok: true as const,
      preCheckIn: result.preCheckIn,
      deviceToken,
      student: studentRow ? buildStudentPreview(studentRow) : null,
    };
  });

/** Public: returning student — 900 number only, no re-typing name/email. */
export const submitReturningPreCheckIn = createServerFn({ method: "POST" })
  .inputValidator(preCheckInReturningInputSchema)
  .handler(async ({ data }) => {
    await rateLimit("lookup", data.preToken);
    const resolved = await getEventForPreCheckIn(data.preToken);
    if (!resolved.ok) {
      return { ok: false as const, state: resolved.state as PreCheckInBlockedState };
    }

    const universityId = await requireEventUniversityId(resolved.event);
    const { data: student, error } = await (await getSupabaseAdmin())
      .from("students")
      .select("id, first_name, last_name, student_email")
      .eq("nine_hundred_number", data.nineHundredNumber)
      .eq("university_id", universityId)
      .maybeSingle();
    if (error) throw new Error(safeMessage(error, "Unable to look up student."));
    if (!student) return { ok: false as const, state: "student_not_found" as const };

    const result = await insertPreCheckIn({
      eventId: resolved.event.id,
      studentId: student.id,
      method: "returning_lookup",
    });
    if (!result.ok) {
      return { ok: false as const, state: result.state, checkedInAt: result.checkedInAt };
    }

    return { ok: true as const, preCheckIn: result.preCheckIn, student: buildStudentPreview(student) };
  });

/** Host: read the early head count roster for an event. */
export const getEventPreCheckIns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(eventIdInputSchema)
  .handler(async ({ data, context }) => {
    await requireOwnedEvent(context.supabase, context.userId, data.eventId);
    const { data: rows, error } = await context.supabase
      .from("pre_check_ins")
      .select("id, checked_in_at, check_in_method, students(id, first_name, last_name, student_email, nine_hundred_number)")
      .eq("event_id", data.eventId)
      .order("checked_in_at", { ascending: false });
    if (error) throw new Error(safeMessage(error));

    return ((rows ?? []) as Array<{
      id: string;
      checked_in_at: string;
      check_in_method: string;
      students: { id: string; first_name: string; last_name: string; student_email: string; nine_hundred_number: string } | null;
    }>).map((row) => ({
      id: row.id,
      checkedInAt: row.checked_in_at,
      method: row.check_in_method,
      student: row.students
        ? {
            id: row.students.id,
            firstName: row.students.first_name,
            lastName: row.students.last_name,
            studentEmail: row.students.student_email,
            nineHundredNumber: row.students.nine_hundred_number,
          }
        : null,
    })) as PreCheckInRow[];
  });

/** Host: turn the early head count on/off without touching the event form. */
export const togglePreCheckIn = createServerFn({ method: "POST" })
  .middleware([requireHostActive])
  .inputValidator(togglePreCheckInSchema)
  .handler(async ({ data, context }) => {
    const existing = await requireOwnedEvent(context.supabase, context.userId, data.eventId);
    const admin = await getSupabaseAdmin();

    if (!data.enabled) {
      const { error } = await admin
        .from("events")
        .update({ pre_check_in_enabled: false, updated_at: new Date().toISOString() })
        .eq("id", data.eventId);
      if (error) throw new Error(safeMessage(error, "Unable to update early check-in."));
      return { ok: true as const, enabled: false, preCheckInToken: null };
    }

    // Reuse an existing window when the host already configured one; otherwise
    // default to "opens 7 days before day-of check-in, closes when it opens".
    const window = existing.pre_check_in_opens_at && existing.pre_check_in_closes_at
      ? { preCheckInOpensAt: existing.pre_check_in_opens_at, preCheckInClosesAt: existing.pre_check_in_closes_at }
      : buildDefaultPreCheckInWindow(existing.check_in_opens_at);

    const token = existing.pre_check_in_token ?? createQrToken();
    const { error } = await admin
      .from("events")
      .update({
        pre_check_in_enabled: true,
        pre_check_in_opens_at: window.preCheckInOpensAt,
        pre_check_in_closes_at: window.preCheckInClosesAt,
        pre_check_in_token: token,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.eventId);
    if (error) throw new Error(safeMessage(error, "Unable to update early check-in."));
    return { ok: true as const, enabled: true, preCheckInToken: token };
  });

/** Host: rotate the marketing link if it leaks. */
export const regeneratePreCheckInToken = createServerFn({ method: "POST" })
  .middleware([requireHostActive])
  .inputValidator(regeneratePreCheckInTokenSchema)
  .handler(async ({ data, context }) => {
    const existing = await requireOwnedEvent(context.supabase, context.userId, data.eventId);
    if (!existing.pre_check_in_enabled) {
      throw new Error("Early check-in is not enabled for this event.");
    }
    const admin = await getSupabaseAdmin();

    let lastError: { code?: string; message?: string } | null = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      const candidate = createQrToken();
      const { data: updated, error } = await admin
        .from("events")
        .update({ pre_check_in_token: candidate, updated_at: new Date().toISOString() })
        .eq("id", data.eventId)
        .select("pre_check_in_token")
        .single();
      if (!error && updated?.pre_check_in_token) {
        return { ok: true as const, preCheckInToken: updated.pre_check_in_token };
      }
      lastError = error;
      if (!error || error.code !== "23505") break;
    }
    throw new Error(safeMessage(lastError, "Unable to regenerate early check-in link."));
  });
