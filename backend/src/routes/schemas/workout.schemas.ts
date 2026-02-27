import { z } from "zod";

export const completeSessionSchema = z.object({
  actualDuration: z.number().int().min(1).max(600),
  rpe: z.number().int().min(1).max(10),
  athleteNotes: z.string().optional(),
});

export const skipSessionSchema = z.object({
  reason: z.string().optional(),
});

export const historyQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const rescheduleSessionSchema = z.object({
  newDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD format"),
});

export type CompleteSession = z.infer<typeof completeSessionSchema>;
export type SkipSession = z.infer<typeof skipSessionSchema>;
export type RescheduleSession = z.infer<typeof rescheduleSessionSchema>;
