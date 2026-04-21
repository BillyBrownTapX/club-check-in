import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getRequestHeader, setResponseHeader } from "@tanstack/react-start/server";
import { notFound } from "@tanstack/react-router";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import {
  buildHostOnboardingState,
  type ClubDetailPayload,
  type ClubSummary,
  combineDateAndTime,
  createDeviceToken,
  createQrToken,
  type EventFormPayload,
  type EventFormValues,
  getCheckInStatus,
  maskEmail,
  type ManagementEventSummary,
  shiftTimeString,
  slugifyClubName,
  type AttendanceRow,
  type Club,
  type EventSummary,
  type EventTemplateWithClub,
  type EventWithClub,
  type HostOnboardingState,
  type HostProfile,
  type PublicStudentPreview,
} from "@/lib/attendance-hq";
async function getSupabaseAdmin() {
  const mod = await import("@/integrations/supabase/client.server");
  return mod.supabaseAdmin;
}

import {
  clubSchema,
  clubUpdateSchema,
  eventSchema,
  eventListFilterSchema,
  eventTemplateSchema,
  eventTemplateUpdateSchema,
  eventUpdateSchema,
  fastCheckInSchema,
  forgotPasswordSchema,
  removeAttendanceSchema,
  resetPasswordSchema,
  returningLookupSchema,
  signInSchema,
  signUpSchema,
  studentRegistrationSchema,
  validatedEventSchema,
} from "@/lib/attendance-hq-schemas";
import { z } from "zod";

async function ensureHostProfile(userId: string, fallback?: { fullName?: string | null; email?: string | null }) {
  const { data: existingProfile, error: existingError } = await (await getSupabaseAdmin())
    .from("host_profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (existingError) throw new Error(existingError.message);
  if (existingProfile) return existingProfile as HostProfile;

  const fullName = fallback?.fullName?.trim() || fallback?.email?.split("@")[0] || "Host";
  const email = fallback?.email?.trim().toLowerCase();

  const { data: createdProfile, error: createError } = await (await getSupabaseAdmin())
    .from("host_profiles")
    .upsert({ id: userId, full_name: fullName, email: email ?? `${userId}@attendancehq.local` }, { onConflict: "id" })
    .select("*")
    .single();

  if (createError || !createdProfile) throw new Error(createError?.message ?? "Unable to create host profile");
  return createdProfile as HostProfile;
}

async function resolveHostOnboardingState(userId: string): Promise<HostOnboardingState> {
  const [{ data: profile, error: profileError }, { data: club, error: clubError }] = await Promise.all([
    (await getSupabaseAdmin()).from("host_profiles").select("*").eq("id", userId).maybeSingle(),
    (await getSupabaseAdmin()).from("clubs").select("*").eq("host_id", userId).order("created_at", { ascending: true }).limit(1).maybeSingle(),
  ]);

  if (profileError) throw new Error(profileError.message);
  if (clubError) throw new Error(clubError.message);

  let event = null;
  if (club?.id) {
    const { data: firstEvent, error: eventError } = await (await getSupabaseAdmin())
      .from("events")
      .select("*")
      .eq("club_id", club.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (eventError) throw new Error(eventError.message);
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
  .inputValidator((input: { qrToken: string }) => input)
  .handler(async ({ data }) => {
    const { data: event, error } = await (await getSupabaseAdmin())
      .from("events")
      .select("*, clubs(id, club_name, club_slug, description)")
      .eq("qr_token", data.qrToken)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!event) throw notFound();

    return event as EventWithClub;
  });

export const signUpHost = createServerFn({ method: "POST" })
  .inputValidator(signUpSchema)
  .handler(async ({ data }) => {
    const { data: authData, error } = await (await getSupabaseAdmin()).auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName },
    });

    if (error) throw new Error(error.message);
    if (!authData.user) throw new Error("Unable to create account");

    await ensureHostProfile(authData.user.id, { fullName: data.fullName, email: data.email });
    setResponseHeader("x-attendance-created-user", authData.user.id);
    return { ok: true, email: data.email, userId: authData.user.id };
  });

export const signInHost = createServerFn({ method: "POST" })
  .inputValidator(signInSchema)
  .handler(async ({ data }) => {
    const { data: userLookup, error } = await (await getSupabaseAdmin()).auth.admin.listUsers();
    if (error) throw new Error(error.message);

    const matchedUser = userLookup.users.find((user) => user.email?.toLowerCase() === data.email);
    if (!matchedUser) {
      return { ok: false as const, message: "Invalid email or password" };
    }

    await ensureHostProfile(matchedUser.id, {
      fullName: typeof matchedUser.user_metadata?.full_name === "string" ? matchedUser.user_metadata.full_name : null,
      email: matchedUser.email,
    });

    return {
      ok: true as const,
      onboarding: await resolveHostOnboardingState(matchedUser.id),
    };
  });

export const sendPasswordReset = createServerFn({ method: "POST" })
  .inputValidator(forgotPasswordSchema)
  .handler(async ({ data }) => {
    const origin = getRequestHeader("origin") ?? "";
    const { error } = await (await getSupabaseAdmin()).auth.resetPasswordForEmail(data.email, {
      redirectTo: `${origin}/reset-password`,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getHostOnboardingState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const profile = await ensureHostProfile(context.userId);
    const onboarding = await resolveHostOnboardingState(context.userId);
    return { profile, onboarding };
  });

export const completePasswordReset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(resetPasswordSchema)
  .handler(async ({ data, context }) => {
    const { error } = await (await getSupabaseAdmin()).auth.admin.updateUserById(context.userId, {
      password: data.password,
    });

    if (error) throw new Error(error.message);
    return { ok: true };
  });

function toManagementEventSummary(event: EventSummary): ManagementEventSummary {
  return {
    ...event,
    attendanceCount: event.attendance_records?.length ?? 0,
    checkInStatus: getCheckInStatus(event),
  };
}

type AppSupabaseClient = SupabaseClient<Database>;

async function resolveHostOnboardingStateWithClient(supabase: AppSupabaseClient, userId: string): Promise<HostOnboardingState> {
  const [{ data: profile, error: profileError }, { data: club, error: clubError }] = await Promise.all([
    supabase.from("host_profiles").select("*").eq("id", userId).maybeSingle(),
    supabase.from("clubs").select("*").eq("host_id", userId).order("created_at", { ascending: true }).limit(1).maybeSingle(),
  ]);

  if (profileError) throw new Error(profileError.message);
  if (clubError) throw new Error(clubError.message);

  let event = null;
  if (club?.id) {
    const { data: firstEvent, error: eventError } = await supabase
      .from("events")
      .select("*")
      .eq("club_id", club.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (eventError) throw new Error(eventError.message);
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
  if (error) throw new Error(error.message);
  return (data ?? []).map((club) => club.id);
}

async function requireOwnedClub(supabase: AppSupabaseClient, userId: string, clubId: string) {
  const { data, error } = await supabase.from("clubs").select("*").eq("id", clubId).eq("host_id", userId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw notFound();
  return data as Club;
}

async function requireOwnedEvent(supabase: AppSupabaseClient, userId: string, eventId: string) {
  const { data, error } = await supabase
    .from("events")
    .select("*, clubs(id, club_name, club_slug, description, host_id)")
    .eq("id", eventId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  const event = data as (EventWithClub & { clubs: (EventWithClub["clubs"] & { host_id?: string }) | null }) | null;
  if (!event || !event.clubs || event.clubs.host_id !== userId) throw notFound();
  return event as EventWithClub;
}

async function getHostClubSummariesForUser(supabase: AppSupabaseClient, userId: string): Promise<ClubSummary[]> {
  const { data: clubs, error: clubsError } = await supabase
    .from("clubs")
    .select("*")
    .eq("host_id", userId)
    .order("created_at", { ascending: true });

  if (clubsError) throw new Error(clubsError.message);

  const clubIds = (clubs ?? []).map((club) => club.id);
  const { data: events, error: eventsError } = clubIds.length
    ? await supabase
        .from("events")
        .select("id, club_id, event_date, check_in_opens_at, check_in_closes_at, is_active, is_archived, attendance_records(id)")
        .in("club_id", clubIds)
    : { data: [], error: null };

  if (eventsError) throw new Error(eventsError.message);

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

  if (error) throw new Error(error.message);
  return (templates ?? []) as EventTemplateWithClub[];
}

async function getHostEventsForUser(
  supabase: AppSupabaseClient,
  userId: string,
  filters: { clubId?: string; status: "all" | "upcoming" | "past"; query?: string },
) {
  const clubIds = filters.clubId ? [filters.clubId] : await getOwnedClubIds(supabase, userId);
  if (!clubIds.length) return [] as ManagementEventSummary[];

  let query = supabase
    .from("events")
    .select("*, clubs(id, club_name, club_slug), attendance_records(id)")
    .in("club_id", clubIds)
    .order("event_date", { ascending: filters.status !== "past" })
    .order("start_time", { ascending: true });

  if (filters.query) query = query.ilike("event_name", `%${filters.query}%`);

  const { data: events, error } = await query;
  if (error) throw new Error(error.message);

  const today = new Date().toISOString().slice(0, 10);
  return ((events ?? []) as EventSummary[])
    .filter((event) => {
      if (filters.status === "upcoming") return event.event_date >= today;
      if (filters.status === "past") return event.event_date < today;
      return true;
    })
    .map(toManagementEventSummary);
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

  if (error || !event) throw new Error(error?.message ?? "Unable to create event");
  return {
    event: event as EventWithClub,
    onboarding: await resolveHostOnboardingStateWithClient(supabase, userId),
  };
}

export const getHostWorkspace = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const profile = await ensureHostProfile(context.userId);
    const clubs = await getHostClubSummariesForUser(context.supabase, context.userId);
    const events = await getHostEventsForUser(context.supabase, context.userId, { clubId: "", status: "all", query: "" });
    const templates = await getHostTemplatesForUser(context.supabase, context.userId, "");

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

    if (eventsError) throw new Error(eventsError.message);
    if (templatesError) throw new Error(templatesError.message);

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

    if (error || !club) throw new Error(error?.message ?? "Unable to create club");
    return club as Club;
  });

export const updateClub = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(clubUpdateSchema)
  .handler(async ({ data, context }) => {
    await requireOwnedClub(context.supabase, context.userId, data.clubId);
    const nextSlug = `${slugifyClubName(data.clubName) || "club"}-${data.clubId.slice(0, 4)}`;

    const { data: club, error } = await context.supabase
      .from("clubs")
      .update({
        club_name: data.clubName.trim(),
        club_slug: nextSlug,
        description: data.description?.trim() || null,
        is_active: data.isActive,
      })
      .eq("id", data.clubId)
      .select("*")
      .single();

    if (error || !club) throw new Error(error?.message ?? "Unable to update club");
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

    if (error || !template) throw new Error(error?.message ?? "Unable to create template");
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

    if (error || !template) throw new Error(error?.message ?? "Unable to update template");
    return template as EventTemplateWithClub;
  });

export const duplicateEventTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { templateId: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: template, error } = await context.supabase
      .from("event_templates")
      .select("*")
      .eq("id", data.templateId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!template) throw notFound();

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

    if (duplicateError || !duplicated) throw new Error(duplicateError?.message ?? "Unable to duplicate template");
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
        initialValues = {
          ...initialValues,
          clubId: template.club_id,
          eventTemplateId: template.id,
          eventName: template.default_event_name || "",
          location: template.default_location || "",
          startTime,
          endTime: template.default_end_time || defaults.endTime,
          checkInOpensAt: combineDateAndTime(defaults.eventDate, `${shiftTimeString(startTime, -Math.abs(template.default_check_in_open_offset_minutes))}:00`),
          checkInClosesAt: combineDateAndTime(defaults.eventDate, `${shiftTimeString(startTime, template.default_check_in_close_offset_minutes)}:00`),
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
        qr_token: existing.qr_token,
      })
      .eq("id", data.eventId)
      .select("*, clubs(id, club_name, club_slug, description)")
      .single();

    if (error || !event) throw new Error(error?.message ?? "Unable to update event");
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
    const { data: attendance, error } = await context.supabase
      .from("attendance_records")
      .select("*, students(id, first_name, last_name, student_email, nine_hundred_number)")
      .eq("event_id", data.eventId)
      .order("checked_in_at", { ascending: false });

    if (error) throw new Error(error.message);
    return { event, attendance: (attendance ?? []) as AttendanceRow[] };
  });

function buildStudentPreview(student: { id: string; first_name: string; last_name: string; student_email: string }): PublicStudentPreview {
  return {
    id: student.id,
    firstName: student.first_name,
    lastInitial: student.last_name.charAt(0).toUpperCase(),
    maskedEmail: maskEmail(student.student_email),
  };
}

async function getEventForPublicCheckIn(eventId: string) {
  const { data: event, error } = await (await getSupabaseAdmin()).from("events").select("*").eq("id", eventId).maybeSingle();
  if (error) throw new Error(error.message);
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

  if (error) throw new Error(error.message);
  return data;
}

async function createAttendanceRecord(input: {
  eventId: string;
  studentId: string;
  method: "qr_scan" | "returning_lookup" | "remembered_device";
}) {
  const eventCheck = await getEventForPublicCheckIn(input.eventId);
  if (!eventCheck.ok) return eventCheck;

  const existingAttendance = await getExistingAttendance(input.eventId, input.studentId);
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
      event_id: input.eventId,
      student_id: input.studentId,
      check_in_method: input.method,
      check_in_source: "public_mobile",
    })
    .select("id, checked_in_at")
    .single();

  if (error || !attendance) throw new Error(error?.message ?? "Unable to record attendance");
  return { ok: true as const, attendance };
}

export const studentCheckIn = createServerFn({ method: "POST" })
  .inputValidator(studentRegistrationSchema.extend({ eventId: returningLookupSchema.shape.nineHundredNumber.transform(() => "") }).transform((value) => ({ ...value, eventId: String((value as { eventId?: unknown }).eventId ?? "") })))
  .handler(async ({ data }) => {
    const eventCheck = await getEventForPublicCheckIn(data.eventId);
    if (!eventCheck.ok) return eventCheck;

    const { data: existingStudent, error: existingStudentError } = await (await getSupabaseAdmin())
      .from("students")
      .select("id, first_name, last_name, student_email")
      .eq("nine_hundred_number", data.nineHundredNumber)
      .maybeSingle();

    if (existingStudentError) throw new Error(existingStudentError.message);

    if (existingStudent) {
      const existingAttendance = await getExistingAttendance(data.eventId, existingStudent.id);
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

    if (studentError || !student) throw new Error(studentError?.message ?? "Unable to save student");

    const attendanceResult = await createAttendanceRecord({
      eventId: data.eventId,
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

      if (sessionError) throw new Error(sessionError.message);
    }

    return {
      ok: true as const,
      attendance: attendanceResult.attendance,
      deviceToken,
      student: buildStudentPreview(student),
    };
  });

export const getRememberedStudent = createServerFn({ method: "POST" })
  .inputValidator((input: { eventId: string; deviceToken: string }) => input)
  .handler(async ({ data }) => {
    const eventCheck = await getEventForPublicCheckIn(data.eventId);
    if (!eventCheck.ok) return eventCheck;

    const { data: session, error } = await (await getSupabaseAdmin())
      .from("student_device_sessions")
      .select("id, student_id")
      .eq("device_token", data.deviceToken)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!session) {
      return { ok: false as const, state: "student_not_found" as const };
    }

    const { data: student, error: studentError } = await (await getSupabaseAdmin())
      .from("students")
      .select("id, first_name, last_name, student_email")
      .eq("id", session.student_id)
      .maybeSingle();

    if (studentError) throw new Error(studentError.message);
    if (!student) {
      return { ok: false as const, state: "student_not_found" as const };
    }

    const existingAttendance = await getExistingAttendance(data.eventId, session.student_id);
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
      studentId: session.student_id,
    };
  });

export const fastCheckIn = createServerFn({ method: "POST" })
  .inputValidator(fastCheckInSchema)
  .handler(async ({ data }) => {
    const { data: session, error: sessionError } = await (await getSupabaseAdmin())
      .from("student_device_sessions")
      .select("id")
      .eq("student_id", data.studentId)
      .eq("device_token", data.deviceToken)
      .maybeSingle();

    if (sessionError) throw new Error(sessionError.message);
    if (!session) {
      return { ok: false as const, state: "student_not_found" as const };
    }

    const attendanceResult = await createAttendanceRecord({
      eventId: data.eventId,
      studentId: data.studentId,
      method: "remembered_device",
    });

    if (!attendanceResult.ok) return attendanceResult;

    await (await getSupabaseAdmin()).from("student_device_sessions").update({ last_used_at: new Date().toISOString() }).eq("id", session.id);

    return { ok: true as const, attendance: attendanceResult.attendance };
  });

export const confirmReturningStudent = createServerFn({ method: "POST" })
  .inputValidator((input: { eventId: string; studentId: string }) => input)
  .handler(async ({ data }) => {
    const attendanceResult = await createAttendanceRecord({
      eventId: data.eventId,
      studentId: data.studentId,
      method: "returning_lookup",
    });

    if (!attendanceResult.ok) return attendanceResult;
    return { ok: true as const, attendance: attendanceResult.attendance };
  });

export const lookupStudent = createServerFn({ method: "POST" })
  .inputValidator(returningLookupSchema.extend({ eventId: returningLookupSchema.shape.nineHundredNumber.transform(() => "") }).transform((value) => ({ ...value, eventId: String((value as { eventId?: unknown }).eventId ?? "") })))
  .handler(async ({ data }) => {
    const eventCheck = await getEventForPublicCheckIn(data.eventId);
    if (!eventCheck.ok) return eventCheck;

    const { data: student, error } = await (await getSupabaseAdmin())
      .from("students")
      .select("id, first_name, last_name, student_email")
      .eq("nine_hundred_number", data.nineHundredNumber)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!student) {
      return { ok: false as const, state: "student_not_found" as const };
    }

    const existingAttendance = await getExistingAttendance(data.eventId, student.id);
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
    const { data: record } = await (await getSupabaseAdmin()).from("attendance_records").select("*").eq("id", data.attendanceRecordId).maybeSingle();
    if (!record) throw new Error("Attendance record not found");

    await (await getSupabaseAdmin()).from("attendance_records").delete().eq("id", data.attendanceRecordId);
    await (await getSupabaseAdmin()).from("attendance_actions").insert({
      event_id: data.eventId,
      attendance_record_id: data.attendanceRecordId,
      host_id: context.userId,
      action_type: "removed",
      notes: "Removed from host dashboard",
    });

    return { ok: true };
  });

export const closeCheckInEarly = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { eventId: string }) => input)
  .handler(async ({ data }) => {
    const { error } = await (await getSupabaseAdmin())
      .from("events")
      .update({ is_active: false, check_in_closes_at: new Date().toISOString() })
      .eq("id", data.eventId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export function buildEventDefaults(date = new Date()) {
  const eventDate = date.toISOString().slice(0, 10);
  const startTime = "18:00";
  const endTime = "19:00";
  return {
    eventDate,
    startTime,
    endTime,
    checkInOpensAt: combineDateAndTime(eventDate, "17:45:00"),
    checkInClosesAt: combineDateAndTime(eventDate, "19:15:00"),
  };
}
