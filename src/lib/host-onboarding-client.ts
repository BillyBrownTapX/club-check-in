import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { buildHostOnboardingState, createQrToken, slugifyClubName, type AttendanceRow, type Club, type EventWithClub, type HostOnboardingState, type HostProfile } from "@/lib/attendance-hq";

export async function ensureClientHostProfile(user: User, fallbackName?: string) {
  const { data: existing, error: existingError } = await supabase
    .from("host_profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (existingError) throw new Error(existingError.message);
  if (existing) return existing as HostProfile;

  const fullName = fallbackName?.trim() || (typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name.trim() : "") || user.email?.split("@")[0] || "Host";
  const email = user.email?.trim().toLowerCase() || `${user.id}@attendancehq.local`;

  const { data, error } = await supabase
    .from("host_profiles")
    .upsert({ id: user.id, full_name: fullName, email }, { onConflict: "id" })
    .select("*")
    .single();

  if (error || !data) throw new Error(error?.message || "Unable to create host profile");
  return data as HostProfile;
}

export async function getClientOnboardingState(userId: string): Promise<HostOnboardingState> {
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
    event: event as EventWithClub | null,
  });
}

export async function createFirstClub(userId: string, values: { clubName: string; description?: string }) {
  const existingState = await getClientOnboardingState(userId);
  if (existingState.club) {
    return { club: existingState.club, onboarding: existingState };
  }

  const baseSlug = slugifyClubName(values.clubName);
  const clubSlug = `${baseSlug || "club"}-${Math.random().toString(36).slice(2, 6)}`;
  const { data, error } = await supabase
    .from("clubs")
    .insert({
      host_id: userId,
      club_name: values.clubName.trim(),
      club_slug: clubSlug,
      description: values.description?.trim() || null,
    })
    .select("*")
    .single();

  if (error || !data) throw new Error(error?.message || "Unable to create club");

  return {
    club: data as Club,
    onboarding: await getClientOnboardingState(userId),
  };
}

export async function createFirstEvent(values: {
  clubId: string;
  eventName: string;
  eventDate: string;
  startTime: string;
  endTime: string;
  location?: string;
  checkInOpensAt: string;
  checkInClosesAt: string;
}) {
  const { data, error } = await supabase
    .from("events")
    .insert({
      club_id: values.clubId,
      event_name: values.eventName.trim(),
      event_date: values.eventDate,
      start_time: values.startTime,
      end_time: values.endTime,
      location: values.location?.trim() || null,
      check_in_opens_at: values.checkInOpensAt,
      check_in_closes_at: values.checkInClosesAt,
      qr_token: createQrToken(),
    })
    .select("*, clubs(id, club_name, club_slug, description)")
    .single();

  if (error || !data) throw new Error(error?.message || "Unable to create event");
  return data as EventWithClub;
}

export async function getHostEventDetail(eventId: string, userId: string) {
  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("*, clubs(id, club_name, club_slug, description, host_id)")
    .eq("id", eventId)
    .maybeSingle();

  if (eventError) throw new Error(eventError.message);
  const eventWithOwner = event as (EventWithClub & { clubs: (EventWithClub["clubs"] & { host_id?: string }) | null }) | null;
  if (!eventWithOwner || !eventWithOwner.clubs || eventWithOwner.clubs.host_id !== userId) return null;

  const { data: attendance, error: attendanceError } = await supabase
    .from("attendance_records")
    .select("*, students(id, first_name, last_name, student_email, nine_hundred_number)")
    .eq("event_id", eventId)
    .order("checked_in_at", { ascending: false });

  if (attendanceError) throw new Error(attendanceError.message);

  return {
    event: eventWithOwner as EventWithClub,
    attendance: (attendance ?? []) as AttendanceRow[],
  };
}
