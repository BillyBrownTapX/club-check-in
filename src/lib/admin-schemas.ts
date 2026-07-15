import { z } from "zod";
import { emailSchema } from "@/lib/attendance-hq-schemas";

export const listAdminHostsSchema = z.object({
  q: z.string().trim().max(120).optional().or(z.literal("")),
});

export const listAdminClubsSchema = z.object({
  q: z.string().trim().max(120).optional().or(z.literal("")),
});

export const setHostDisabledSchema = z.object({
  hostId: z.string().uuid(),
  disabled: z.boolean(),
  reason: z.string().trim().max(280, "Reason is too long").optional().or(z.literal("")),
});

export const setClubActiveSchema = z.object({
  clubId: z.string().uuid(),
  isActive: z.boolean(),
});

// Domain rules: lowercase, no leading '@', simple `label.tld` shape,
// dedup + sort. Reject anything with whitespace or path characters.
const domainSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(253, "Domain is too long")
  .regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/, "Invalid domain");

export const upsertAdminUniversitySchema = z.object({
  universityId: z.string().uuid().optional().or(z.literal("")),
  name: z.string().trim().min(2, "Enter a name").max(160, "Name is too long"),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(2, "Enter a slug")
    .max(80, "Slug is too long")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase letters, numbers, and dashes"),
  allowedEmailDomains: z
    .array(domainSchema)
    .max(24, "Too many domains")
    .default([]),
});

export { emailSchema };
