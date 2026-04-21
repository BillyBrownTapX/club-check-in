import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader, setResponseHeader } from "@tanstack/react-start/server";
import { notFound, redirect } from "@tanstack/react-router";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  combineDateAndTime,
  createQrToken,
  slugifyClubName,
  type AttendanceRow,
  type Club,
  type EventSummary,
  type EventTemplateWithClub,
  type EventWithClub,
  type HostProfile,
} from "@/lib/attendance-hq";
import {
  clubSchema,
  eventSchema,
  eventTemplateSchema,
  fastCheckInSchema,
  forgotPasswordSchema,
  removeAttendanceSchema,
  signUpSchema,
  studentRegistrationSchema,
} from "@/lib/attendance-hq-schemas";

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
    const origin = getRequestHeader("origin") ?? process.env.SUPABASE_URL ?? "";
    const { data: authData, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: false,
      user_metadata: { full_name: data.fullName },
    });

    if (error) throw new Error(error.message);
    if (!authData.user) throw new Error("Unable to create account");

    setResponseHeader("x-attendance-created-user", authData.user.id);
    return { ok: true, email: data.email, redirectTo: `${origin}/sign-in` };
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

export const studentCheckIn = createServerFn({ method: "POST" })
  .inputValidator(studentRegistrationSchema.extend({ eventId: studentRegistrationSchema.shape.nineHundredNumber.transform(() => "") }).transform((value) => value as unknown as { firstName: string; lastName: string; studentEmail: string; nineHundredNumber: string; rememberDevice: boolean; eventId: string }))
  .handler(async ({ data }) => {
    const { data: event, error: eventError } = await supabaseAdmin.from("events").select("*").eq("id", data.eventId).maybeSingle();
    if (eventError) throw new Error(eventError.message);
    if (!event) throw new Error("Event not found");

    let studentId: string | null = null;
    const { data: existingStudent } = await supabaseAdmin.from("students").select("*").eq("nine_hundred_number", data.nineHundredNumber).maybeSingle();

    if (existingStudent) {
      studentId = existingStudent.id;
    } else {
      const { data: student, error: studentError } = await supabaseAdmin
        .from("students")
        .insert({
          first_name: data.firstName.trim(),
          last_name: data.lastName.trim(),
          student_email: data.studentEmail,
          nine_hundred_number: data.nineHundredNumber,
        })
        .select("id")
        .single();
      if (studentError || !student) throw new Error(studentError?.message ?? "Unable to save student");
      studentId = student.id;
    }

    const { data: attendance, error: attendanceError } = await supabaseAdmin
      .from("attendance_records")
      .insert({
        event_id: data.eventId,
        student_id: studentId,
        check_in_method: "qr_scan",
        check_in_source: "public_mobile",
      })
      .select("*")
      .single();

    if (attendanceError) throw new Error(attendanceError.message);
    return attendance;
  });

export const fastCheckIn = createServerFn({ method: "POST" })
  .inputValidator(fastCheckInSchema)
  .handler(async ({ data }) => {
    const { data: session } = await supabaseAdmin
      .from("student_device_sessions")
      .select("*")
      .eq("student_id", data.studentId)
      .eq("device_token", data.deviceToken)
      .maybeSingle();

    if (!session) throw new Error("Remembered device not found");

    const { data: attendance, error } = await supabaseAdmin
      .from("attendance_records")
      .insert({
        event_id: data.eventId,
        student_id: data.studentId,
        check_in_method: "remembered_device",
        check_in_source: "public_mobile",
      })
      .select("*")
      .single();

    if (error) throw new Error(error.message);

    await supabaseAdmin
      .from("student_device_sessions")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", session.id);

    return attendance;
  });

export const confirmReturningStudent = createServerFn({ method: "POST" })
  .inputValidator((input: { eventId: string; studentId: string }) => input)
  .handler(async ({ data }) => {
    const { data: attendance, error } = await supabaseAdmin
      .from("attendance_records")
      .insert({
        event_id: data.eventId,
        student_id: data.studentId,
        check_in_method: "returning_lookup",
        check_in_source: "public_mobile",
      })
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    return attendance;
  });

export const lookupStudent = createServerFn({ method: "POST" })
  .inputValidator((input: { nineHundredNumber: string }) => input)
  .handler(async ({ data }) => {
    const { data: student, error } = await supabaseAdmin.from("students").select("*").eq("nine_hundred_number", data.nineHundredNumber).maybeSingle();
    if (error) throw new Error(error.message);
    return student;
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
