// Input schemas for the Owner Admin dashboard. Client-safe (no server imports).
import { z } from "zod";

export const OWNER_ADMIN_EMAIL = "billy.brown@ingresssoftware.com";

// Health-score weighting. Configurable in one place so it can be tuned later
// without touching SQL or UI. Must sum to 1.
export const HEALTH_WEIGHTS = {
  recency: 0.3,
  eventFrequency: 0.25,
  volume: 0.2,
  adminEngagement: 0.15,
  featureAdoption: 0.1,
} as const;

export const ORG_STATUSES = [
  "power_user",
  "healthy",
  "at_risk",
  "churning",
  "dormant",
  "never_activated",
] as const;

export type OrgStatus = (typeof ORG_STATUSES)[number];

export const ORG_STATUS_LABELS: Record<OrgStatus, string> = {
  power_user: "Power user",
  healthy: "Healthy",
  at_risk: "At risk",
  churning: "Churning",
  dormant: "Dormant",
  never_activated: "Never activated",
};

export const dateRangeSchema = z.object({
  // Inclusive start / exclusive end, ISO timestamps.
  from: z.string().min(4),
  to: z.string().min(4),
  bucket: z.enum(["day", "week", "month"]).default("day"),
});

export const paginationSchema = z.object({
  q: z.string().max(120).optional(),
  limit: z.number().int().min(1).max(200).default(25),
  offset: z.number().int().min(0).default(0),
});

export const organizationsQuerySchema = paginationSchema.extend({
  status: z.enum(["all", ...ORG_STATUSES]).default("all"),
  universityId: z.string().uuid().optional(),
  sort: z
    .enum(["name", "created", "members", "events", "checkins", "health", "last_activity"])
    .default("last_activity"),
  dir: z.enum(["asc", "desc"]).default("desc"),
});

export const organizationDetailSchema = z.object({ clubId: z.string().uuid() });

export const eventsQuerySchema = paginationSchema.extend({
  clubId: z.string().uuid().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

export const attendanceQuerySchema = z.object({
  from: z.string().min(4),
  to: z.string().min(4),
});
