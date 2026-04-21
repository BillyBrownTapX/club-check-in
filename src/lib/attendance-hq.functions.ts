import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader, setResponseHeader } from "@tanstack/react-start/server";
import { notFound, redirect } from "@tanstack/react-router";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  buildHostOnboardingState,
  combineDateAndTime,
  createDeviceToken,
  createQrToken,
  getCheckInStatus,
  maskEmail,
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
import {
  clubSchema,
  eventSchema,
  eventTemplateSchema,
  fastCheckInSchema,
  forgotPasswordSchema,
  removeAttendanceSchema,
  resetPasswordSchema,
  returningLookupSchema,
  signInSchema,
  signUpSchema,
  studentRegistrationSchema,
} from "@/lib/attendance-hq-schemas";

async function ensureHostProfile(userId: string, fallback?: { fullName?: string | null; email?: string | null }) {
  const { data: existingProfile, error: existingError } = await supabaseAdmin
    .from("host_profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (existingError) throw new Error(existingError.message);
  if (existingProfile) return existingProfile as HostProfile;

  const fullName = fallback?.fullName?.trim() || fallback?.email?.split("@")[0] || "Host";
  const email = fallback?.email?.trim().toLowerCase();

  const { data: createdProfile, error: createError } = await supabaseAdmin
    .from("host_profiles")
    .upsert({ id: userId, full_name: fullName, email: email ?? `${userId}@attendancehq.local` }, { onConflict: "id" })
    .select("*")
    .single();

  if (createError || !createdProfile) throw new Error(createError?.message ?? "Unable to create host profile");
  return createdProfile as HostProfile;
}

async function resolveHostOnboardingState(userId: string): Promise<HostOnboardingState> {
  const [{ data: profile, error: profileError }, { data: club, error: clubError }] = await Promise.all([
    supabaseAdmin.from("host_profiles").select("*").eq("id", userId).maybeSingle(),
    supabaseAdmin.from("clubs").select("*").eq("host_id", userId).order("created_at", { ascending: true }).limit(1).maybeSingle(),
  ]);

  if (profileError) throw new Error(profileError.message);
  if (clubError) throw new Error(clubError.message);

  let event = null;
  if (club?.id) {
    const { data: firstEvent, error: eventError } = await supabaseAdmin
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
  const { data, error } = await supabaseAdmin.from("host_profiles").select("*").eq("id", userId).single();
  if (error || !data) throw new Error("Host profile not found");
  return data as HostProfile;
}

export const getPublicEventByQr = createServerFn({ method: "GET" })
  .inputValidator((input: { qrToken: string }) => input)
  .handler(async ({ data }) => {
    const { data: event, error } = await supabaseAdmin
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
    const { data: authData, error } = await supabaseAdmin.auth.admin.createUser({
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
    const { data: userLookup, error } = await supabaseAdmin.auth.admin.listUsers();
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
    const { error } = await supabaseAdmin.auth.resetPasswordForEmail(data.email, {
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
    const { error } = await supabaseAdmin.auth.admin.updateUserById(context.userId, {
      password: data.password,
    });

    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getHostWorkspace = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const profile = await requireHostProfile(context.userId);

    const [{ data: clubs }, { data: templates }, { data: events }] = await Promise.all([
      supabaseAdmin.from("clubs").select("*").eq("host_id", context.userId).order("created_at", { ascending: false }),
      supabaseAdmin
        .from("event_templates")
        .select("*, clubs(id, club_name, club_slug)")
        .in(
          "club_id",
          (await supabaseAdmin.from("clubs").select("id").eq("host_id", context.userId)).data?.map((club) => club.id) ?? ["00000000-0000-0000-0000-000000000000"],
        )
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("events")
        .select("*, clubs(id, club_name, club_slug), attendance_records(id, checked_in_at, student_id)")
        .in(
          "club_id",
          (await supabaseAdmin.from("clubs").select("id").eq("host_id", context.userId)).data?.map((club) => club.id) ?? ["00000000-0000-0000-0000-000000000000"],
        )
        .order("event_date", { ascending: true }),
    ]);

    return {
      profile,
      clubs: (clubs ?? []) as Club[],
      templates: (templates ?? []) as EventTemplateWithClub[],
      events: (events ?? []) as EventSummary[],
    };
  });

export const createClub = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(clubSchema)
  .handler(async ({ data, context }) => {
    const baseSlug = slugifyClubName(data.clubName);
    const slug = `${baseSlug || "club"}-${Math.random().toString(36).slice(2, 6)}`;

    const { data: club, error } = await supabaseAdmin
      .from("clubs")
      .insert({
        host_id: context.userId,
        club_name: data.clubName.trim(),
        club_slug: slug,
        description: data.description?.trim() || null,
      })
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    return club as Club;
  });

export const createEventTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(eventTemplateSchema)
  .handler(async ({ data, context }) => {
    const { data: club } = await supabaseAdmin.from("clubs").select("id").eq("id", data.clubId).eq("host_id", context.userId).maybeSingle();
    if (!club) throw new Error("Club not found");

    const { data: template, error } = await supabaseAdmin
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

    if (error) throw new Error(error.message);
    return template as EventTemplateWithClub;
  });

export const createEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(eventSchema)
  .handler(async ({ data, context }) => {
    const { data: club } = await supabaseAdmin.from("clubs").select("id").eq("id", data.clubId).eq("host_id", context.userId).maybeSingle();
    if (!club) throw new Error("Club not found");

    const { data: event, error } = await supabaseAdmin
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

    if (error) throw new Error(error.message);
    return event as EventWithClub;
  });

export const getEventOperations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { eventId: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: event, error } = await supabaseAdmin
      .from("events")
      .select("*, clubs(id, club_name, club_slug, description)")
      .eq("id", data.eventId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!event) throw notFound();

    const { data: club } = await supabaseAdmin.from("clubs").select("host_id").eq("id", event.club_id).maybeSingle();
    if (!club || club.host_id !== context.userId) throw redirect({ to: "/sign-in" });

    const { data: attendance } = await supabaseAdmin
      .from("attendance_records")
      .select("*, students(id, first_name, last_name, student_email, nine_hundred_number)")
      .eq("event_id", data.eventId)
      .order("checked_in_at", { ascending: false });

    return { event: event as EventWithClub, attendance: (attendance ?? []) as AttendanceRow[] };
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
  const { data: event, error } = await supabaseAdmin.from("events").select("*").eq("id", eventId).maybeSingle();
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
  const { data, error } = await supabaseAdmin
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

  const { data: attendance, error } = await supabaseAdmin
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

    const { data: existingStudent, error: existingStudentError } = await supabaseAdmin
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

    const { data: student, error: studentError } = await supabaseAdmin
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
      const { error: sessionError } = await supabaseAdmin.from("student_device_sessions").insert({
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

    const { data: session, error } = await supabaseAdmin
      .from("student_device_sessions")
      .select("id, student_id")
      .eq("device_token", data.deviceToken)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!session) {
      return { ok: false as const, state: "student_not_found" as const };
    }

    const { data: student, error: studentError } = await supabaseAdmin
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
    const { data: session, error: sessionError } = await supabaseAdmin
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

    await supabaseAdmin.from("student_device_sessions").update({ last_used_at: new Date().toISOString() }).eq("id", session.id);

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

    const { data: student, error } = await supabaseAdmin
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
    const { data: record } = await supabaseAdmin.from("attendance_records").select("*").eq("id", data.attendanceRecordId).maybeSingle();
    if (!record) throw new Error("Attendance record not found");

    await supabaseAdmin.from("attendance_records").delete().eq("id", data.attendanceRecordId);
    await supabaseAdmin.from("attendance_actions").insert({
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
    const { error } = await supabaseAdmin
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
