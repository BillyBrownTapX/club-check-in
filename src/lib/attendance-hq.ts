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

export type ClubSummary = Club & {
  upcomingEventsCount: number;
  pastEventsCount: number;
  totalCheckIns: number;
};

export type ManagementEventSummary = Event & {
  clubs: Pick<Club, "id" | "club_name" | "club_slug"> | null;
  attendance_records?: Pick<AttendanceRecord, "id">[];
  attendanceCount: number;
  checkInStatus: CheckInStatus;
};

export type ClubDetailPayload = {
  club: Club;
  stats: {
    upcomingEvents: number;
    pastEvents: number;
    totalCheckIns: number;
  };
  upcomingEvents: ManagementEventSummary[];
  pastEvents: ManagementEventSummary[];
  templates: EventTemplateWithClub[];
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

export type PublicBlockedState =
  | "invalid_link"
  | "event_not_found"
  | "not_open_yet"
  | "closed"
  | "already_checked_in"
  | "student_not_found"
  | "invalid_900_number";

export type PublicStudentPreview = {
  id: string;
  firstName: string;
  lastInitial: string;
  maskedEmail: string;
};

export type HostOnboardingState = {
  hasProfile: boolean;
  club: Club | null;
  event: Event | null;
  isComplete: boolean;
  nextPath: string;
};

export type EventListStatusFilter = "all" | "upcoming" | "past";

export type EventFormValues = {
  clubId: string;
  eventTemplateId?: string;
  eventName: string;
  eventDate: string;
  startTime: string;
  endTime: string;
  location?: string;
  checkInOpensAt: string;
  checkInClosesAt: string;
};

export type EventFormPayload = {
  clubs: Club[];
  templates: EventTemplateWithClub[];
  initialValues: EventFormValues;
  sourceEventId?: string;
};

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

export function getPublicBlockedState(status: CheckInStatus): Extract<PublicBlockedState, "not_open_yet" | "closed"> | null {
  if (status === "upcoming") return "not_open_yet";
  if (status === "closed" || status === "inactive" || status === "archived") return "closed";
  return null;
}

export function getBlockedStateCopy(state: PublicBlockedState) {
  switch (state) {
    case "invalid_link":
      return {
        title: "Invalid check-in link",
        description: "This link is invalid or no longer available.",
      };
    case "event_not_found":
      return {
        title: "Event not found",
        description: "We couldn’t find this event.",
      };
    case "not_open_yet":
      return {
        title: "Check-in not open yet",
        description: "Check-in is not open for this event yet.",
      };
    case "closed":
      return {
        title: "Check-in closed",
        description: "Check-in is closed for this event.",
      };
    case "already_checked_in":
      return {
        title: "Already checked in",
        description: "You have already checked in for this event.",
      };
    case "student_not_found":
      return {
        title: "Student not found",
        description: "We couldn’t find a student with that 900 number.",
      };
    case "invalid_900_number":
      return {
        title: "Invalid 900 number",
        description: "Enter a valid 9-digit 900 number.",
      };
  }
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

export function buildHostOnboardingState(input: {
  profile: HostProfile | null;
  club: Club | null;
  event: Event | null;
}): HostOnboardingState {
  const hasProfile = Boolean(input.profile);
  const club = input.club;
  const event = input.event;

  if (!club) {
    return {
      hasProfile,
      club: null,
      event: null,
      isComplete: false,
      nextPath: "/onboarding/club",
    };
  }

  if (!event) {
    return {
      hasProfile,
      club,
      event: null,
      isComplete: false,
      nextPath: "/onboarding/event",
    };
  }

  return {
    hasProfile,
    club,
    event,
    isComplete: true,
    nextPath: "/clubs",
  };
}

export function shiftTimeString(time: string, minutes: number) {
  const [hours, mins] = time.slice(0, 5).split(":").map(Number);
  const total = hours * 60 + mins + minutes;
  const wrapped = ((total % 1440) + 1440) % 1440;
  const nextHours = String(Math.floor(wrapped / 60)).padStart(2, "0");
  const nextMinutes = String(wrapped % 60).padStart(2, "0");
  return `${nextHours}:${nextMinutes}`;
}

export function buildEventDefaults(date = new Date()) {
  const eventDate = date.toISOString().slice(0, 10);
  const startTime = "18:00";
  const endTime = "19:00";
  return {
    eventDate,
    startTime,
    endTime,
    checkInOpensAt: combineDateAndTime(eventDate, "17:45:00"),
    checkInClosesAt: combineDateAndTime(eventDate, "18:20:00"),
  };
}
