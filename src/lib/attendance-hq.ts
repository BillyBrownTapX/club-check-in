import type { Tables } from "@/integrations/supabase/types";

export type HostProfile = Tables<"host_profiles">;
export type Club = Tables<"clubs">;
export type EventTemplate = Tables<"event_templates">;
export type Event = Tables<"events">;
export type Student = Tables<"students">;
export type AttendanceRecord = Tables<"attendance_records">;
export type DeviceSession = Tables<"student_device_sessions">;

export type EventSummary = Event & {
  clubs: Pick<Club, "id" | "club_name" | "club_slug"> | null;
  attendance_records?: Pick<AttendanceRecord, "id" | "checked_in_at" | "student_id">[];
};

export type EventWithClub = Event & {
  clubs: Pick<Club, "id" | "club_name" | "club_slug" | "description"> | null;
};

export type EventTemplateWithClub = EventTemplate & {
  clubs: Pick<Club, "id" | "club_name" | "club_slug"> | null;
};

export type AttendanceRow = AttendanceRecord & {
  students: Pick<Student, "id" | "first_name" | "last_name" | "student_email" | "nine_hundred_number"> | null;
};

export type CheckInStatus =
  | "open"
  | "upcoming"
  | "closed"
  | "inactive"
  | "archived";

export const PRODUCT_NAME = "Attendance HQ";
export const PRODUCT_DOMAIN = "attendance-hq.com";
export const HOST_REDIRECT_KEY = "attendance-hq-auth-redirect";
export const DEVICE_TOKEN_KEY = "attendance-hq-device-token";

export function slugifyClubName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function createQrToken() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789abcdefghijkmnopqrstuvwxyz";
  return Array.from({ length: 24 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}

export function createDeviceToken() {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length: 36 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}

export function formatEventDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${date}T00:00:00`));
}

export function formatEventTime(startTime: string, endTime?: string | null) {
  const format = (value: string) =>
    new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(`1970-01-01T${value}`));

  return endTime ? `${format(startTime)} – ${format(endTime)}` : format(startTime);
}

export function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function getCheckInStatus(event: Pick<Event, "check_in_opens_at" | "check_in_closes_at" | "is_active" | "is_archived">): CheckInStatus {
  if (event.is_archived) return "archived";
  if (!event.is_active) return "inactive";

  const now = Date.now();
  const opens = new Date(event.check_in_opens_at).getTime();
  const closes = new Date(event.check_in_closes_at).getTime();

  if (now < opens) return "upcoming";
  if (now > closes) return "closed";
  return "open";
}

export function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  const visible = local.slice(0, Math.min(4, local.length));
  return `${visible}${"*".repeat(Math.max(2, local.length - visible.length))}@${domain}`;
}

export function getStudentShortName(student: Pick<Student, "first_name" | "last_name">) {
  const initial = student.last_name.charAt(0).toUpperCase();
  return `${student.first_name} ${initial}.`;
}

export function combineDateAndTime(date: string, time: string) {
  return new Date(`${date}T${time}`).toISOString();
}

export function isValidNineHundredNumber(value: string) {
  return /^\d{9}$/.test(value.trim());
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}
