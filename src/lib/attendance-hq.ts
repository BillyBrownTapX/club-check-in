import type { Tables } from "@/integrations/supabase/types";

export type HostProfile = Tables<"host_profiles">;
export type University = Tables<"universities">;
export type Club = Tables<"clubs">;
export type EventTemplate = Tables<"event_templates">;
export type Event = Tables<"events">;
export type Student = Tables<"students">;
export type AttendanceRecord = Tables<"attendance_records">;
export type AttendanceAction = Tables<"attendance_actions">;
export type DeviceSession = Tables<"student_device_sessions">;

export type HostActivityType = "first_check_in" | "threshold_reached" | "check_in_closed";

export type HostActivityEntry = {
  id: string;
  activityType: HostActivityType;
  threshold: number | null;
  attendanceCount: number | null;
  createdAt: string;
  event: { id: string; eventName: string; eventDate: string };
  club: { id: string; clubName: string };
};

// Attendance thresholds we announce as milestones. Kept small on purpose —
// hosts should feel milestones, not get spammed on every check-in.
export const HOST_ACTIVITY_THRESHOLDS = [10, 25, 50, 100] as const;

export type EventSummary = Event & {
  clubs: Pick<Club, "id" | "club_name" | "club_slug"> | null;
  // PostgREST returns embedded aggregates as `[{ count: N }]`. We keep the legacy
  // `attendance_records?: { id }[]` shape as an optional fallback for places that
  // haven't migrated yet — `toManagementEventSummary` reads whichever is present.
  attendance_records?: Pick<AttendanceRecord, "id">[] | { count: number }[];
};

export type ClubWithUniversity = Club & {
  universities: Pick<University, "id" | "name" | "slug"> | null;
};

export type EventWithClub = Event & {
  clubs: (Pick<Club, "id" | "club_name" | "club_slug" | "description" | "university_id"> & {
    universities?: Pick<University, "id" | "name" | "slug"> | null;
  }) | null;
};

export type EventTemplateWithClub = EventTemplate & {
  clubs: Pick<Club, "id" | "club_name" | "club_slug"> | null;
};

export type ClubSummary = Club & {
  upcomingEventsCount: number;
  pastEventsCount: number;
  totalCheckIns: number;
  universities?: Pick<University, "id" | "name" | "slug"> | null;
};

export type ManagementEventSummary = Event & {
  clubs: Pick<Club, "id" | "club_name" | "club_slug"> | null;
  attendance_records?: Pick<AttendanceRecord, "id">[] | { count: number }[];
  attendanceCount: number;
  checkInStatus: CheckInStatus;
};

export type ClubMemberEntry = {
  id: string;
  userId: string;
  role: "owner" | "officer";
  fullName: string;
  email: string;
  createdAt: string;
};

export type ClubDetailPayload = {
  club: ClubWithUniversity;
  universities: University[];
  stats: {
    upcomingEvents: number;
    pastEvents: number;
    totalCheckIns: number;
  };
  upcomingEvents: ManagementEventSummary[];
  pastEvents: ManagementEventSummary[];
  templates: EventTemplateWithClub[];
  members: ClubMemberEntry[];
  viewerRole: "owner" | "officer" | null;
};

export type AttendanceRow = AttendanceRecord & {
  students: Pick<Student, "id" | "first_name" | "last_name" | "student_email" | "nine_hundred_number"> | null;
};

export type AttendanceActionStudentSnapshot = Pick<Student, "id" | "first_name" | "last_name" | "student_email" | "nine_hundred_number">;

export type AttendanceActionLog = AttendanceAction & {
  student: AttendanceActionStudentSnapshot | null;
  checkedInAt: string | null;
  attendanceRecordId: string | null;
  kind: string | null;
};

export type EventAttendanceSummary = {
  total: number;
  recent: number;
  removedCount: number;
  lastActionAt: string | null;
  methodBreakdown: {
    firstScan: number;
    returning: number;
    remembered: number;
    manual: number;
  };
};

// One row of the early head count roster shown on event ops. `converted`
// means the student also checked in on the day of the event.
export type PreCheckInListRow = {
  id: string;
  checkedInAt: string;
  method: string;
  converted: boolean;
  student: {
    id: string;
    firstName: string;
    lastName: string;
    studentEmail: string;
    nineHundredNumber: string;
  } | null;
};

export type EventOperationsPayload = {
  event: EventWithClub;
  attendance: AttendanceRow[];
  removedAttendance: AttendanceActionLog[];
  recentActions: AttendanceActionLog[];
  summary: EventAttendanceSummary;
  // Pre-event head count (never mixed into attendance numbers).
  preCheckInCount: number;
  // How many of the early head count have actually checked in on the day.
  preCheckInConvertedCount: number;
  // Full early head count roster, newest first.
  preCheckIns: PreCheckInListRow[];
};


export type EventDisplayPayload = {
  event: EventWithClub;
  summary: EventAttendanceSummary;
  attendanceCount: number;
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
  firstName: string;
  lastInitial: string;
  maskedEmail: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Pre-event check-in ("early head count").
//
// Additive, opt-in feature: hosts can open a separate, arbitrarily long
// window BEFORE the event where members tap a marketing link to say "I'm
// coming". These rows live in `pre_check_ins` and never count as attendance —
// members still check in on the day of the event.
// ─────────────────────────────────────────────────────────────────────────────

export type PreCheckIn = Tables<"pre_check_ins">;

export type PreCheckInStatus = "disabled" | "upcoming" | "open" | "closed";

export type PreCheckInEventFields = Pick<
  Event,
  "pre_check_in_enabled" | "pre_check_in_opens_at" | "pre_check_in_closes_at" | "is_archived"
>;

export type PreCheckInRow = {
  id: string;
  checkedInAt: string;
  method: string;
  student: {
    id: string;
    firstName: string;
    lastName: string;
    studentEmail: string;
    nineHundredNumber: string;
  } | null;
};

export function getPreCheckInStatus(event: PreCheckInEventFields): PreCheckInStatus {
  if (!event.pre_check_in_enabled) return "disabled";
  if (event.is_archived) return "closed";
  if (!event.pre_check_in_opens_at || !event.pre_check_in_closes_at) return "disabled";

  const now = Date.now();
  const opens = new Date(event.pre_check_in_opens_at).getTime();
  const closes = new Date(event.pre_check_in_closes_at).getTime();
  if (now < opens) return "upcoming";
  if (now > closes) return "closed";
  return "open";
}

export const PRE_CHECK_IN_COPY = {
  heading: "Early head count",
  subheading:
    "Let the host know you're planning to come. This is not attendance — remember to check in at the event.",
  successTitle: "You're on the early head count",
  successBody: "Thanks! Remember to check in at the event so your attendance is recorded.",
  notOpenTitle: "Early head count not open yet",
  notOpenBody: "The host hasn't opened the early head count for this event yet. Check back soon.",
  closedTitle: "Early head count closed",
  closedBody: "The early head count for this event is closed. You can still check in at the event itself.",
} as const;

/**
 * Shifts an optional pre check-in window by `days` calendar days, keeping the
 * wall-clock time. Returns nulls untouched so disabled events stay disabled
 * when duplicated.
 */
export function shiftPreCheckInWindowByDays(
  source: { preCheckInOpensAt: string | null; preCheckInClosesAt: string | null },
  days: number = 7,
): { preCheckInOpensAt: string | null; preCheckInClosesAt: string | null } {
  const dayMs = 24 * 60 * 60 * 1000;
  const shiftIso = (iso: string | null) => {
    if (!iso) return null;
    const t = new Date(iso).getTime();
    if (!Number.isFinite(t)) return iso;
    return new Date(t + days * dayMs).toISOString();
  };
  return {
    preCheckInOpensAt: shiftIso(source.preCheckInOpensAt),
    preCheckInClosesAt: shiftIso(source.preCheckInClosesAt),
  };
}

/** Default pre check-in window when a host first enables it: opens 7 days
 * before the event's check-in opens, closes when day-of check-in opens. */
export function buildDefaultPreCheckInWindow(checkInOpensAt: string): {
  preCheckInOpensAt: string;
  preCheckInClosesAt: string;
} {
  const opensMs = new Date(checkInOpensAt).getTime();
  const safeOpens = Number.isFinite(opensMs) ? opensMs : Date.now();
  return {
    preCheckInOpensAt: new Date(safeOpens - 7 * 24 * 60 * 60 * 1000).toISOString(),
    preCheckInClosesAt: new Date(safeOpens).toISOString(),
  };
}


export type ClubAttendanceReportEvent = {
  id: string;
  eventName: string;
  eventDate: string;
};

export type ClubAttendanceReportStudent = {
  studentId: string;
  firstName: string;
  lastName: string;
  studentEmail: string;
  nineHundredNumber: string;
  totalCheckIns: number;
  // Parallel to events[]: null when the student did not check in to that event,
  // otherwise the ISO checked_in_at timestamp of their first check-in for it.
  attendanceByEventId: Record<string, string | null>;
};

export type ClubAttendanceReportPayload = {
  club: { id: string; club_name: string };
  fromDate: string;
  toDate: string;
  events: ClubAttendanceReportEvent[];
  students: ClubAttendanceReportStudent[];
  summary: { eventCount: number; studentCount: number; totalCheckIns: number };
  // True when either events or students were capped by CLUB_REPORT_MAX_* — the
  // CSV export streams the full range and should be recommended in the UI.
  truncated: boolean;
};

/**
 * Membership + growth metrics for the host Home page, aggregated across every
 * club the host can access. "Member" = a student who has ever checked in OR
 * pre-checked in, so the count doubles as the size of the outreach list.
 */
export type HostMemberMetrics = {
  totalMembers: number;
  membersWithEmail: number;
  /** Members whose first activity landed in the last 30 days. */
  newMembers30d: number;
  newMembersPrior30d: number;
  /** Percent change of new members vs the prior 30-day window; null when no prior baseline. */
  growthRatePct: number | null;
  /** Members eligible for retention (first activity before the most recent past event). */
  retentionEligible: number;
  /** Of those, how many attended a later event. */
  retentionReturned: number;
  retentionPct: number | null;
  pastEventCount: number;
  /** Average check-ins (incl. pre-check-ins) per past event. */
  avgAttendancePerEvent: number;
  /** Avg attendance as a share of total members — the "event success" score. */
  eventSuccessPct: number | null;
  clubCount: number;
};


export const CLUB_REPORT_MAX_EVENTS = 40;
export const CLUB_REPORT_MAX_STUDENTS = 400;
export const CLUB_REPORT_DEFAULT_RANGE_DAYS = 120;

// Default retention window for attendance history. Roughly two academic
// years — long enough to cover any single-semester audit + a follow-up
// semester, short enough that stale check-in rosters don't linger forever.
// Hosts can purge data older than this via the club "Data & privacy" panel.
// Campus policy may require different retention; hosts must follow theirs.
export const ATTENDANCE_RETENTION_DAYS = 730;

export function getAttendanceRetentionCutoffDate(now: Date = new Date()): string {
  const cutoffMs = now.getTime() - ATTENDANCE_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  return new Date(cutoffMs).toISOString().slice(0, 10);
}

export function getDefaultClubReportRange(now: Date = new Date()): { fromDate: string; toDate: string } {
  const toDate = now.toISOString().slice(0, 10);
  const fromMs = now.getTime() - CLUB_REPORT_DEFAULT_RANGE_DAYS * 24 * 60 * 60 * 1000;
  const fromDate = new Date(fromMs).toISOString().slice(0, 10);
  return { fromDate, toDate };
}

export type HostOnboardingState = {
  hasProfile: boolean;
  club: Club | null;
  event: Event | null;
  isComplete: boolean;
  nextPath: string;
};

export type EventListStatusFilter = "all" | "active" | "upcoming" | "past";

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
  // Pre-event ("early head count") window. Optional and independent of the
  // day-of check-in window; the host may make it as long as they like.
  preCheckInEnabled?: boolean;
  preCheckInOpensAt?: string;
  preCheckInClosesAt?: string;
};


export type EventFormPayload = {
  clubs: ClubWithUniversity[];
  universities: University[];
  templates: EventTemplateWithClub[];
  initialValues: EventFormValues;
  sourceEventId?: string;
};

export const PRODUCT_NAME = "Attendance HQ";
export const PRODUCT_DOMAIN = "attendance-hq.com";
export const HOST_REDIRECT_KEY = "attendance-hq-auth-redirect";
export const DEVICE_TOKEN_KEY = "attendance-hq-device-token";

// Canonical published origin. Auth emails (confirm signup, password reset)
// MUST land here — never on a Lovable preview host or localhost — otherwise
// clicked links won't open the real app.
//
// NOTE: Supabase Auth's own Site URL + Redirect allowlist (configured in the
// Lovable/Supabase dashboard) must include this origin. Code alone cannot
// change the Auth Site URL; the redirect helpers below just tell Supabase
// which URL to embed in the outgoing email.
export const PRODUCTION_APP_ORIGIN = "https://attendance-hq.com";

function normalizeOrigin(raw: string): string {
  return raw.trim().replace(/\/+$/, "");
}

function looksLikePreviewOrLocal(origin: string): boolean {
  try {
    const url = new URL(origin);
    const host = url.hostname;
    if (host === "localhost" || host === "127.0.0.1" || host.endsWith(".local")) return true;
    if (host.startsWith("id-preview--")) return true;
    // Any lovable.app subdomain that isn't the canonical published host.
    if (host.endsWith(".lovable.app") && origin !== PRODUCTION_APP_ORIGIN) return true;
    return false;
  } catch {
    return true;
  }
}

/**
 * Returns the origin that outgoing auth emails should link back to. Prefers
 * an explicit VITE_PUBLIC_APP_URL / VITE_APP_URL override; otherwise falls
 * back to PRODUCTION_APP_ORIGIN. Never uses window.location.origin for a
 * preview/localhost host — email links must resolve on the real deploy.
 */
export function getAuthEmailRedirectOrigin(): string {
  const envOverride =
    (import.meta.env?.VITE_PUBLIC_APP_URL as string | undefined) ||
    (import.meta.env?.VITE_APP_URL as string | undefined);
  if (envOverride && envOverride.trim().length > 0) {
    return normalizeOrigin(envOverride);
  }
  if (typeof window !== "undefined") {
    const current = normalizeOrigin(window.location.origin);
    if (!looksLikePreviewOrLocal(current)) return current;
  }
  return PRODUCTION_APP_ORIGIN;
}

export function getConfirmEmailRedirectUrl(): string {
  return `${getAuthEmailRedirectOrigin()}/sign-in`;
}

export function getResetPasswordRedirectUrl(): string {
  return `${getAuthEmailRedirectOrigin()}/reset-password`;
}

// Starter template seeded on new clubs (and lazily added to existing clubs
// with zero templates). Positive offsets mean "N minutes before start" for
// open and "N minutes after end" for close — matches getEventFormPayload's
// template application math.
export const WEEKLY_MEETING_TEMPLATE_DEFAULTS = {
  template_name: "Weekly Meeting",
  default_event_name: "Weekly Meeting",
  default_location: null as string | null,
  default_start_time: "18:00",
  default_end_time: "19:00",
  default_check_in_open_offset_minutes: 15,
  default_check_in_close_offset_minutes: 15,
} as const;

// Remembered-device tokens expire so a leaked or long-idle device stops
// getting the welcome-back fast path. Either threshold trips the client
// back to first-time / returning check-in.
export const DEVICE_SESSION_MAX_AGE_DAYS = 180;
export const DEVICE_SESSION_IDLE_DAYS = 90;

export function isDeviceSessionExpired(session: {
  created_at?: string | null;
  last_used_at?: string | null;
}): boolean {
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const created = session.created_at ? new Date(session.created_at).getTime() : NaN;
  if (Number.isFinite(created) && now - created > DEVICE_SESSION_MAX_AGE_DAYS * dayMs) {
    return true;
  }
  const lastUsed = session.last_used_at ? new Date(session.last_used_at).getTime() : NaN;
  if (Number.isFinite(lastUsed) && now - lastUsed > DEVICE_SESSION_IDLE_DAYS * dayMs) {
    return true;
  }
  return false;
}

export function slugifyClubName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

const URL_SAFE_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

function getRandomBytes(length: number): Uint8Array {
  const cryptoObj: Crypto | undefined =
    typeof globalThis !== "undefined" ? (globalThis as { crypto?: Crypto }).crypto : undefined;
  if (!cryptoObj || typeof cryptoObj.getRandomValues !== "function") {
    throw new Error(
      "Secure random source unavailable: globalThis.crypto.getRandomValues is required for token generation.",
    );
  }
  const bytes = new Uint8Array(length);
  cryptoObj.getRandomValues(bytes);
  return bytes;
}

function generateSecureToken(length: number): string {
  const bytes = getRandomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += URL_SAFE_ALPHABET[bytes[i] & 0x3f];
  }
  return out;
}

export function createQrToken() {
  return generateSecureToken(24);
}

export function createDeviceToken() {
  return generateSecureToken(36);
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

/**
 * Shifts an event's date + check-in window forward by `days` calendar days,
 * keeping wall-clock times intact. Used by the "duplicate next week" flow.
 * - eventDate is a YYYY-MM-DD string; shifted via UTC to avoid DST/tz drift.
 * - checkInOpensAt / checkInClosesAt are ISO timestamps; adding
 *   `days * 86_400_000` ms preserves the clock time across the shift for
 *   non-DST-edge cases (a weekly rollover).
 */
export function shiftEventScheduleByDays(
  source: { eventDate: string; checkInOpensAt: string; checkInClosesAt: string },
  days: number = 7,
): { eventDate: string; checkInOpensAt: string; checkInClosesAt: string } {
  const [yStr, mStr, dStr] = source.eventDate.slice(0, 10).split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  const d = Number(dStr);
  let shiftedDate = source.eventDate;
  if (Number.isFinite(y) && Number.isFinite(m) && Number.isFinite(d)) {
    const shifted = new Date(Date.UTC(y, m - 1, d));
    shifted.setUTCDate(shifted.getUTCDate() + days);
    const yy = shifted.getUTCFullYear();
    const mm = String(shifted.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(shifted.getUTCDate()).padStart(2, "0");
    shiftedDate = `${yy}-${mm}-${dd}`;
  }
  const dayMs = 24 * 60 * 60 * 1000;
  const shiftIso = (iso: string) => {
    const t = new Date(iso).getTime();
    if (!Number.isFinite(t)) return iso;
    return new Date(t + days * dayMs).toISOString();
  };
  return {
    eventDate: shiftedDate,
    checkInOpensAt: shiftIso(source.checkInOpensAt),
    checkInClosesAt: shiftIso(source.checkInClosesAt),
  };
}

export function getCheckInMethodLabel(method: string | null | undefined) {
  if (method === "qr_scan") return "First scan";
  if (method === "returning_lookup") return "Returning";
  if (method === "remembered_device") return "Remembered";
  if (method === "host_correction") return "Manual";
  return "Manual";
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
  // Time values reach us in several shapes: "18:00" from <input type="time">,
  // "18:00:00" from Postgres, and occasionally "18:00:00:00" when a caller
  // appends ":00" to an already-seconds-bearing value. Normalize to HH:MM:SS
  // so this never produces an Invalid Date (toISOString would throw).
  const normalizedTime = `${time.slice(0, 5)}:00`;
  return new Date(`${date}T${normalizedTime}`).toISOString();
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
    checkInOpensAt: combineDateAndTime(eventDate, `${shiftTimeString(startTime, -15)}:00`),
    checkInClosesAt: combineDateAndTime(eventDate, `${shiftTimeString(endTime, 15)}:00`),
  };
}
