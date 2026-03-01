import { z } from "zod";

export const contactSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().optional(),
  email: z.string().email("Must be a valid email address"),
  phone: z.string().optional(),
  interest: z.string().optional(),
  goals: z.string().optional(),
  referral: z.string().optional(),
});

export const consultationSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().optional(),
  email: z.string().email("Must be a valid email address"),
  phone: z.string().optional(),
  preferredDate: z.string().min(1, "Preferred date is required"),
  preferredTime: z.string().min(1, "Preferred time is required"),
  tier: z.string().optional(),
  primaryGoal: z.string().optional(),
  experience: z.string().optional(),
  notes: z.string().optional(),
});

export const slotsQuerySchema = z.object({
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2024).max(2030),
});

export type ContactInput = z.infer<typeof contactSchema>;
export type ConsultationInput = z.infer<typeof consultationSchema>;
export type SlotsQuery = z.infer<typeof slotsQuerySchema>;
