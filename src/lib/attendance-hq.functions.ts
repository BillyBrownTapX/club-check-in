import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { notFound } from "@tanstack/react-router";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import {
  buildEventDefaults,
  buildHostOnboardingState,
  type AttendanceActionLog,
  type AttendanceActionStudentSnapshot,
  type AttendanceRow,
  type Club,
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
  type HostOnboardingState,
  type HostProfile,
  type ManagementEventSummary,
  maskEmail,
  type PublicStudentPreview,
  shiftTimeString,
  slugifyClubName,
} from "@/lib/attendance-hq";
async function getSupabaseAdmin() {
  const mod = await import("@/integrations/supabase/client.server");
  return mod.supabaseAdmin;
}

import {
  clubSchema,
  clubUpdateSchema,
  closeCheckInEarlySchema,
  confirmReturningInputSchema,
  duplicateEventTemplateSchema,
  eventSchema,
  eventListFilterSchema,
  eventTemplateSchema,
  eventTemplateUpdateSchema,
  eventUpdateSchema,
  fastCheckInSchema,
  manualAttendanceSchema,
  qrTokenSchema,
  rememberedDeviceInputSchema,
  removeAttendanceSchema,
  restoreAttendanceSchema,
  returningLookupInputSchema,
  studentCheckInInputSchema,
  toggleEventArchiveSchema,
  validatedEventSchema,
} from "@/lib/attendance-hq-schemas";
import { safeMessage } from "@/lib/server-errors";
import { z } from "zod";

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

async function resolveHostOnboardingState(userId: string): Promise<HostOnboardingState> {
  const [{ data: profile, error: profileError }, { data: club, error: clubError }] = await Promise.all([
    (await getSupabaseAdmin()).from("host_profiles").select("*").eq("id", userId).maybeSingle(),
    (await getSupabaseAdmin()).from("clubs").select("*").eq("host_id", userId).order("created_at", { ascending: true }).limit(1).maybeSingle(),
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
  .handler(async ({ data }) => {
    const { data: event, error } = await (await getSupabaseAdmin())
      .from("events")
      .select("*, clubs(id, club_name, club_slug, description)")
      .eq("qr_token", data.qrToken)
      .maybeSingle();

    if (error) throw new Error(safeMessage(error));
    if (!event) throw notFound();

    return event as EventWithClub;
  });

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
  .inputValidator((input?: { fullName?: string; email?: string } | undefined) => input ?? {})
  .handler(async ({ data, context }) => {
    const claimsEmail = typeof context.claims.email === "string" ? context.claims.email : null;
    const profile = await ensureHostProfile(context.userId, {
      fullName: data?.fullName ?? null,
      email: data?.email ?? claimsEmail,
    });
    const onboarding = await resolveHostOnboardingState(context.userId);
    return { profile, onboarding };
  });

function toManagementEventSummary(event: EventSummary): ManagementEventSummary {
  return {
    ...event,
    attendanceCount: event.attendance_records?.length ?? 0,
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
  kind: "manual_check_in" | "removed" | "restored";
  studentId: string;
  firstName: string;
  lastName: string;
  studentEmail: string;
  nineHundredNumber: string;
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
    supabase.from("clubs").select("*").eq("host_id", userId).order("created_at", { ascending: true }).limit(1).maybeSingle(),
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

async function getOwnedClubIds(supabase: AppSupabaseClient, userId: string) {
  const { data, error } = await supabase.from("clubs").select("id").eq("host_id", userId);
  if (error) throw new Error(safeMessage(error));
  return (data ?? []).map((club) => club.id);
}

async function requireOwnedClub(supabase: AppSupabaseClient, userId: string, clubId: string) {
  const { data, error } = await supabase.from("clubs").select("*").eq("id", clubId).eq("host_id", userId).maybeSingle();
  if (error) throw new Error(safeMessage(error));
  if (!data) throw notFound();
  return data as Club;
}

async function requireOwnedEvent(supabase: AppSupabaseClient, userId: string, eventId: string) {
  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("*")
    .eq("id", eventId)
    .maybeSingle();

  if (eventError) throw new Error(safeMessage(eventError, undefined, "read"));
  if (!event) throw notFound();

  const club = await requireOwnedClub(supabase, userId, event.club_id);

  return {
    ...(event as Database["public"]["Tables"]["events"]["Row"]),
    clubs: {
      id: club.id,
      club_name: club.club_name,
      club_slug: club.club_slug,
      description: club.description,
    },
  } as EventWithClub;
}

async function getHostClubSummariesForUser(supabase: AppSupabaseClient, userId: string): Promise<ClubSummary[]> {
  const { data: clubs, error: clubsError } = await supabase
    .from("clubs")
    .select("*")
    .eq("host_id", userId)
    .order("created_at", { ascending: true });

  if (clubsError) throw new Error(safeMessage(clubsError));

  const clubIds = (clubs ?? []).map((club) => club.id);
  const { data: events, error: eventsError } = clubIds.length
    ? await supabase
        .from("events")
        .select("id, club_id, event_date, check_in_opens_at, check_in_closes_at, is_active, is_archived, attendance_records(id)")
        .in("club_id", clubIds)
    : { data: [], error: null };

  if (eventsError) throw new Error(safeMessage(eventsError));

  const now = new Date().toISOString().slice(0, 10);
  const counts = new Map<string, { upcomingEventsCount: number; pastEventsCount: number; totalCheckIns: number }>();
  for (const club of clubs ?? []) {
    counts.set(club.id, { upcomingEventsCount: 0, pastEventsCount: 0, totalCheckIns: 0 });
  }

  for (const event of events ?? []) {
    const current = counts.get(event.club_id);
    if (!current) continue;
    if (event.event_date >= now) current.upcomingEventsCount += 1;
    else current.pastEventsCount += 1;
    current.totalCheckIns += event.attendance_records?.length ?? 0;
  }

  return ((clubs ?? []) as Club[]).map((club) => ({
    ...club,
    ...(counts.get(club.id) ?? { upcomingEventsCount: 0, pastEventsCount: 0, totalCheckIns: 0 }),
  })) as ClubSummary[];
}

async function getHostTemplatesForUser(supabase: AppSupabaseClient, userId: string, clubId?: string) {
  const clubIds = clubId ? [clubId] : await getOwnedClubIds(supabase, userId);
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
  const clubIds = filters.clubId ? [filters.clubId] : await getOwnedClubIds(supabase, userId);
  if (!clubIds.length) return [] as ManagementEventSummary[];

  let query = supabase
    .from("events")
    .select("*, clubs(id, club_name, club_slug), attendance_records(id)")
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
  await requireOwnedClub(supabase, userId, data.clubId);

  const { data: event, error } = await supabase
    .from("events")
    .insert({
      club_id: data.clubId,
      event_template_id: data.eventTemplateId || null,
      event_name: data.eventName.trim(),
      event_date: data.eventDate,
      start_time: data.startTime,
      end_time: data.endTime,
      location: data.location?.trim() || null,
      check_in_opens_at: data.checkInOpensAt,
      check_in_closes_at: data.checkInClosesAt,
      qr_token: createQrToken(),
    })
    .select("*, clubs(id, club_name, club_slug, description)")
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

export const getHostTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { clubId?: string }) => ({ clubId: input.clubId ?? "" }))
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
  .inputValidator((input: { clubId: string }) => input)
  .handler(async ({ data, context }) => {
    const club = await requireOwnedClub(context.supabase, context.userId, data.clubId);

    const [{ data: events, error: eventsError }, { data: templates, error: templatesError }] = await Promise.all([
      context.supabase
        .from("events")
        .select("*, clubs(id, club_name, club_slug), attendance_records(id)")
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

    const today = new Date().toISOString().slice(0, 10);
    const normalizedEvents = ((events ?? []) as EventSummary[]).map(toManagementEventSummary);
    const upcomingEvents = normalizedEvents.filter((event) => event.event_date >= today);
    const pastEvents = normalizedEvents.filter((event) => event.event_date < today);
    const totalCheckIns = normalizedEvents.reduce((sum, event) => sum + event.attendanceCount, 0);

    return {
      club,
      stats: {
        upcomingEvents: upcomingEvents.length,
        pastEvents: pastEvents.length,
        totalCheckIns,
      },
      upcomingEvents,
      pastEvents,
      templates: (templates ?? []) as EventTemplateWithClub[],
    } as ClubDetailPayload;
  });

export const createClubManagement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(clubSchema)
  .handler(async ({ data, context }) => {
    const baseSlug = slugifyClubName(data.clubName);
    const slug = `${baseSlug || "club"}-${Math.random().toString(36).slice(2, 6)}`;

    const { data: club, error } = await context.supabase
      .from("clubs")
      .insert({
        host_id: context.userId,
        club_name: data.clubName.trim(),
        club_slug: slug,
        description: data.description?.trim() || null,
      })
      .select("*")
      .single();

    if (error || !club) throw new Error(safeMessage(error, "Unable to create club"));
    return club as Club;
  });

export const updateClub = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(clubUpdateSchema)
  .handler(async ({ data, context }) => {
    await requireOwnedClub(context.supabase, context.userId, data.clubId);

    // The slug is the public identifier minted at insert time. Rotating it
    // on every name edit would silently break any external links/QR/
    // bookmarks pointing at the club. Hosts can't edit slugs from the UI,
    // so updates intentionally leave club_slug untouched.
    const { data: club, error } = await context.supabase
      .from("clubs")
      .update({
        club_name: data.clubName.trim(),
        description: data.description?.trim() || null,
        is_active: data.isActive,
      })
      .eq("id", data.clubId)
      .select("*")
      .single();

    if (error || !club) throw new Error(safeMessage(error, "Unable to update club"));
    return club as Club;
  });

export const createEventTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(eventTemplateSchema)
  .handler(async ({ data, context }) => {
    await requireOwnedClub(context.supabase, context.userId, data.clubId);

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
  .middleware([requireSupabaseAuth])
  .inputValidator(eventTemplateUpdateSchema)
  .handler(async ({ data, context }) => {
    await requireOwnedClub(context.supabase, context.userId, data.clubId);

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
  .middleware([requireSupabaseAuth])
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
    await requireOwnedClub(context.supabase, context.userId, template.club_id);

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

export const getEventFormPayload = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { eventId?: string; duplicateFrom?: string; clubId?: string; templateId?: string }) => ({
    eventId: input.eventId ?? "",
    duplicateFrom: input.duplicateFrom ?? "",
    clubId: input.clubId ?? "",
    templateId: input.templateId ?? "",
  }))
  .handler(async ({ data, context }) => {
    const clubIds = await getOwnedClubIds(context.supabase, context.userId);
    const clubs = clubIds.length
      ? ((await context.supabase.from("clubs").select("*").in("id", clubIds).order("club_name", { ascending: true })).data ?? [])
      : [];
    const templates = clubIds.length
      ? ((await context.supabase.from("event_templates").select("*, clubs(id, club_name, club_slug)").in("club_id", clubIds).order("template_name", { ascending: true })).data ?? [])
      : [];

    let initialValues: EventFormValues = {
      clubId: data.clubId,
      eventTemplateId: "",
      eventName: "",
      eventDate: buildEventDefaults().eventDate,
      startTime: buildEventDefaults().startTime,
      endTime: buildEventDefaults().endTime,
      location: "",
      checkInOpensAt: buildEventDefaults().checkInOpensAt,
      checkInClosesAt: buildEventDefaults().checkInClosesAt,
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
      initialValues = {
        clubId: sourceEvent.club_id,
        eventTemplateId: sourceEvent.event_template_id || "",
        eventName: sourceEvent.event_name,
        eventDate: sourceEvent.event_date,
        startTime: sourceEvent.start_time,
        endTime: sourceEvent.end_time,
        location: sourceEvent.location || "",
        checkInOpensAt: sourceEvent.check_in_opens_at,
        checkInClosesAt: sourceEvent.check_in_closes_at,
      };
    }

    return {
      clubs: clubs as Club[],
      templates: templates as EventTemplateWithClub[],
      initialValues,
      sourceEventId: data.duplicateFrom || undefined,
    } as EventFormPayload;
  });

export const createEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validatedEventSchema)
  .handler(async ({ data, context }) => {
    return createEventForUser(context.supabase, context.userId, data);
  });

export const updateEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(eventUpdateSchema)
  .handler(async ({ data, context }) => {
    const existing = await requireOwnedEvent(context.supabase, context.userId, data.eventId);
    await requireOwnedClub(context.supabase, context.userId, data.clubId);

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
      })
      .eq("id", data.eventId)
      .select("*, clubs(id, club_name, club_slug, description)")
      .single();

    if (error || !event) throw new Error(safeMessage(error, "Unable to update event"));
    return event as EventWithClub;
  });

export const duplicateEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(eventSchema.extend({ sourceEventId: z.string().uuid() }).refine((value) => value.endTime > value.startTime, {
    message: "End time must be after start time",
    path: ["endTime"],
  }).refine((value) => new Date(value.checkInClosesAt).getTime() > new Date(value.checkInOpensAt).getTime(), {
    message: "Check-in close must be after open",
    path: ["checkInClosesAt"],
  }))
  .handler(async ({ data, context }) => {
    await requireOwnedEvent(context.supabase, context.userId, data.sourceEventId);
    const { sourceEventId: _sourceEventId, ...eventData } = data;
    return createEventForUser(context.supabase, context.userId, eventData);
  });

export const getEventOperations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { eventId: string }) => input)
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

    return {
      event,
      attendance: normalizedAttendance,
      removedAttendance: [...removedAttendanceMap.values()],
      recentActions,
      summary: buildEventAttendanceSummary(normalizedAttendance, removedAttendanceMap.size, recentActions),
    } as EventOperationsPayload;
  });

export const getEventDisplayPayload = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { eventId: string }) => input)
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

// ─────────────────────────────────────────────────────────────────────────────
// Attendance CSV export
//
// Server-side so the column set, escaping rules, and ownership check live in
// exactly one place. Hosts can only export events they own (requireOwnedEvent
// throws notFound() otherwise — no cross-tenant leakage). The query is keyed
// solely by event_id, so even a misbehaving client cannot widen the result
// set to other clubs' attendance. The CSV string is built here so the client
// download path is just `new Blob([csv])` — no client-side schema drift.
// ─────────────────────────────────────────────────────────────────────────────

const CSV_HEADERS = [
  "First name",
  "Last name",
  "Student email",
  "900 number",
  "Checked in at",
  "Check-in method",
  "Event name",
  "Event date",
  "Location",
  "Club name",
] as const;

function escapeCsvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

const METHOD_EXPORT_LABEL: Record<string, string> = {
  qr_scan: "First scan",
  returning_lookup: "Returning",
  remembered_device: "Remembered",
  host_correction: "Manual",
};

function buildAttendanceFilename(event: EventWithClub) {
  const safeName = event.event_name.replace(/[^a-z0-9-_]+/gi, "_").slice(0, 60) || "event";
  return `${safeName}-attendance-${event.event_date}.csv`;
}

export const exportEventAttendance = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ eventId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const event = await requireOwnedEvent(context.supabase, context.userId, data.eventId);
    const { data: rows, error } = await context.supabase
      .from("attendance_records")
      .select("checked_in_at, check_in_method, students(first_name, last_name, student_email, nine_hundred_number)")
      .eq("event_id", data.eventId)
      .order("checked_in_at", { ascending: true });

    if (error) throw new Error(safeMessage(error));

    const clubName = event.clubs?.club_name ?? "";
    const records = (rows ?? []) as Array<{
      checked_in_at: string;
      check_in_method: string | null;
      students: {
        first_name: string;
        last_name: string;
        student_email: string;
        nine_hundred_number: string | null;
      } | null;
    }>;

    const csvLines = [
      CSV_HEADERS.map(escapeCsvCell).join(","),
      ...records.map((row) => [
        escapeCsvCell(row.students?.first_name),
        escapeCsvCell(row.students?.last_name),
        escapeCsvCell(row.students?.student_email),
        escapeCsvCell(row.students?.nine_hundred_number),
        escapeCsvCell(row.checked_in_at),
        escapeCsvCell(row.check_in_method ? METHOD_EXPORT_LABEL[row.check_in_method] ?? row.check_in_method : ""),
        escapeCsvCell(event.event_name),
        escapeCsvCell(event.event_date),
        escapeCsvCell(event.location ?? ""),
        escapeCsvCell(clubName),
      ].join(",")),
    ];

    return {
      filename: buildAttendanceFilename(event),
      csv: csvLines.join("\r\n"),
      count: records.length,
    };
  });

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

  if (error || !attendance) throw new Error(safeMessage(error, "Unable to record attendance"));
  return { ok: true as const, attendance };
}

// First-time / unknown-student check-in.
// All public flows are keyed by qrToken so the QR capability is re-validated
// every step. The 900 number proves student identity for new registrations;
// returning students get a "this is you" handoff that requires re-confirming
// the 900 number on the next call (see confirmReturningStudent).
export const studentCheckIn = createServerFn({ method: "POST" })
  .inputValidator(studentCheckInInputSchema)
  .handler(async ({ data }) => {
    const eventCheck = await getEventForPublicCheckInByQr(data.qrToken);
    if (!eventCheck.ok) return eventCheck;

    const { data: existingStudent, error: existingStudentError } = await (await getSupabaseAdmin())
      .from("students")
      .select("id, first_name, last_name, student_email")
      .eq("nine_hundred_number", data.nineHundredNumber)
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

    const { data: student, error: studentError } = await (await getSupabaseAdmin())
      .from("students")
      .insert({
        first_name: data.firstName.trim(),
        last_name: data.lastName.trim(),
        student_email: data.studentEmail,
        nine_hundred_number: data.nineHundredNumber,
      })
      .select("id, first_name, last_name, student_email")
      .single();

    if (studentError || !student) throw new Error(safeMessage(studentError, "Unable to save student"));

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
  });

// Remembered-device peek. Returns ONLY the masked preview; the device token
// is the only secret the client holds, so we never echo back the student id.
export const getRememberedStudent = createServerFn({ method: "POST" })
  .inputValidator(rememberedDeviceInputSchema)
  .handler(async ({ data }) => {
    const eventCheck = await getEventForPublicCheckInByQr(data.qrToken);
    if (!eventCheck.ok) return eventCheck;

    const { data: session, error } = await (await getSupabaseAdmin())
      .from("student_device_sessions")
      .select("id, student_id")
      .eq("device_token", data.deviceToken)
      .maybeSingle();

    if (error) throw new Error(safeMessage(error));
    if (!session) {
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
  });

// Fast-path remembered-device check-in. The server resolves the student from
// the device session — clients never tell us who they are. Pre-fix, the
// schema accepted (eventId, studentId, deviceToken) and the studentId could
// be any UUID matched to the device session, so a leaked deviceToken plus a
// guessable studentId was enough to check anyone in.
export const fastCheckIn = createServerFn({ method: "POST" })
  .inputValidator(fastCheckInSchema)
  .handler(async ({ data }) => {
    const eventCheck = await getEventForPublicCheckInByQr(data.qrToken);
    if (!eventCheck.ok) return eventCheck;

    const { data: session, error: sessionError } = await (await getSupabaseAdmin())
      .from("student_device_sessions")
      .select("id, student_id")
      .eq("device_token", data.deviceToken)
      .maybeSingle();

    if (sessionError) throw new Error(safeMessage(sessionError));
    if (!session) {
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
  });

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
  .handler(async ({ data }) => {
    const eventCheck = await getEventForPublicCheckInByQr(data.qrToken);
    if (!eventCheck.ok) return eventCheck;

    const { data: student, error } = await (await getSupabaseAdmin())
      .from("students")
      .select("id")
      .eq("nine_hundred_number", data.nineHundredNumber)
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
  });

// Returning-student lookup. Pre-fix, this returned the raw student UUID and
// took eventId; the client could then post that UUID to confirmReturningStudent
// to mark the student present. The fix removes the UUID from the response —
// it returns only the masked preview ("Sam P. — sam****@…") that lets the
// student visually confirm before the next call.
export const lookupStudent = createServerFn({ method: "POST" })
  .inputValidator(returningLookupInputSchema)
  .handler(async ({ data }) => {
    const eventCheck = await getEventForPublicCheckInByQr(data.qrToken);
    if (!eventCheck.ok) return eventCheck;

    const { data: student, error } = await (await getSupabaseAdmin())
      .from("students")
      .select("id, first_name, last_name, student_email")
      .eq("nine_hundred_number", data.nineHundredNumber)
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
  });

export const removeAttendance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
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
  .middleware([requireSupabaseAuth])
  .inputValidator(manualAttendanceSchema)
  .handler(async ({ data, context }) => {
    const event = await requireOwnedEvent(context.supabase, context.userId, data.eventId);
    const admin = await getSupabaseAdmin();

    let student: AttendanceActionStudentSnapshot | null = null;
    const { data: existingStudent, error: existingStudentError } = await admin
      .from("students")
      .select("id, first_name, last_name, student_email, nine_hundred_number")
      .eq("nine_hundred_number", data.nineHundredNumber)
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
        })
        .select("id, first_name, last_name, student_email, nine_hundred_number")
        .single();
      if (createdStudentError || !createdStudent) throw new Error(safeMessage(createdStudentError, "Unable to save student."));
      student = createdStudent as AttendanceActionStudentSnapshot;
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
    if (attendanceError || !attendance) throw new Error(safeMessage(attendanceError, "Unable to save attendance."));

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

    return { ok: true };
  });

export const restoreAttendance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
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

export const toggleEventArchive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
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
  .middleware([requireSupabaseAuth])
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
    return { ok: true };
  });
