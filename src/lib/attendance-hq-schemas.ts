import { z } from "zod";
import { isValidNineHundredNumber, normalizeEmail } from "@/lib/attendance-hq";

export const emailSchema = z
  .string()
  .trim()
  .min(1, "Email is required")
  .max(255, "Email is too long")
  .email("Enter a valid email")
  .transform(normalizeEmail);

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password is too long");

export const signUpSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name").max(120, "Name is too long"),
  email: emailSchema,
  password: passwordSchema,
});

export const signInSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z.object({
  password: passwordSchema,
  confirmPassword: passwordSchema,
}).refine((value) => value.password === value.confirmPassword, {
  message: "Passwords must match",
  path: ["confirmPassword"],
});

export const clubSchema = z.object({
  clubName: z.string().trim().min(2, "Enter a club name").max(120, "Club name is too long"),
  description: z.string().trim().max(280, "Description is too long").optional().or(z.literal("")),
});

export const clubUpdateSchema = clubSchema.extend({
  clubId: z.string().uuid(),
  isActive: z.boolean().default(true),
});

export const eventTemplateSchema = z.object({
  clubId: z.string().uuid("Choose a club"),
  templateName: z.string().trim().min(2, "Enter a template name").max(120, "Template name is too long"),
  defaultEventName: z.string().trim().max(160, "Event name is too long").optional().or(z.literal("")),
  defaultLocation: z.string().trim().max(160, "Location is too long").optional().or(z.literal("")),
  defaultStartTime: z.string().optional().or(z.literal("")),
  defaultEndTime: z.string().optional().or(z.literal("")),
  defaultCheckInOpenOffsetMinutes: z.coerce.number().int().min(-1440).max(1440),
  defaultCheckInCloseOffsetMinutes: z.coerce.number().int().min(-1440).max(1440),
});

export const eventTemplateUpdateSchema = eventTemplateSchema.extend({
  templateId: z.string().uuid(),
});

export const eventSchema = z.object({
  clubId: z.string().uuid("Choose a club"),
  eventTemplateId: z.string().uuid().optional().or(z.literal("")),
  eventName: z.string().trim().min(2, "Enter an event name").max(160, "Event name is too long"),
  eventDate: z.string().min(1, "Choose a date"),
  startTime: z.string().min(1, "Choose a start time"),
  endTime: z.string().min(1, "Choose an end time"),
  location: z.string().trim().max(160, "Location is too long").optional().or(z.literal("")),
  checkInOpensAt: z.string().min(1, "Choose when check-in opens"),
  checkInClosesAt: z.string().min(1, "Choose when check-in closes"),
});

export const validatedEventSchema = eventSchema.refine((value) => value.endTime > value.startTime, {
  message: "End time must be after start time",
  path: ["endTime"],
}).refine((value) => new Date(value.checkInClosesAt).getTime() > new Date(value.checkInOpensAt).getTime(), {
  message: "Check-in close must be after open",
  path: ["checkInClosesAt"],
});

export const eventUpdateSchema = eventSchema.extend({
  eventId: z.string().uuid(),
}).refine((value) => value.endTime > value.startTime, {
  message: "End time must be after start time",
  path: ["endTime"],
}).refine((value) => new Date(value.checkInClosesAt).getTime() > new Date(value.checkInOpensAt).getTime(), {
  message: "Check-in close must be after open",
  path: ["checkInClosesAt"],
});

export const eventListFilterSchema = z.object({
  clubId: z.string().uuid().optional().or(z.literal("")),
  status: z.enum(["all", "upcoming", "past"]).default("all"),
  query: z.string().trim().max(120).optional().or(z.literal("")),
});

export const returningLookupSchema = z.object({
  nineHundredNumber: z
    .string()
    .trim()
    .refine(isValidNineHundredNumber, "Enter a valid 9-digit 900 number"),
});

export const studentRegistrationSchema = z.object({
  firstName: z.string().trim().min(1, "Enter first name").max(80, "Too long"),
  lastName: z.string().trim().min(1, "Enter last name").max(80, "Too long"),
  studentEmail: emailSchema,
  nineHundredNumber: z
    .string()
    .trim()
    .refine(isValidNineHundredNumber, "Enter a valid 9-digit 900 number"),
  rememberDevice: z.boolean().default(true),
});

export const fastCheckInSchema = z.object({
  eventId: z.string().uuid(),
  studentId: z.string().uuid(),
  deviceToken: z.string().min(24).max(255),
});

export const removeAttendanceSchema = z.object({
  attendanceRecordId: z.string().uuid(),
  eventId: z.string().uuid(),
});
