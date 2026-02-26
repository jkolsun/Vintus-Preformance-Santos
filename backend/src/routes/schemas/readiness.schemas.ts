import { z } from "zod";

export const checkinSchema = z.object({
  perceivedEnergy: z.number().int().min(1).max(10),
  perceivedSoreness: z.number().int().min(1).max(10),
  perceivedMood: z.number().int().min(1).max(10),
  sleepQualityManual: z.number().int().min(1).max(10),
  sleepDurationMin: z.number().int().min(0).max(1440).optional(),
  bodyWeight: z.number().positive().optional(),
  notes: z.string().optional(),
});

export const historyQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(14),
});

export type CheckinInput = z.infer<typeof checkinSchema>;
export type HistoryQuery = z.infer<typeof historyQuerySchema>;
