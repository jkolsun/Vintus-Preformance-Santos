import { z } from "zod";

export const clientNotesSchema = z.object({
  notes: z.string().min(1, "Notes cannot be empty").max(5000),
});

export const customMessageSchema = z.object({
  content: z.string().min(1, "Content cannot be empty").max(1600),
  channel: z.enum(["SMS", "EMAIL"]),
});

export const workoutOverrideSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  sessionType: z
    .enum([
      "STRENGTH_UPPER",
      "STRENGTH_LOWER",
      "STRENGTH_FULL",
      "STRENGTH_PUSH",
      "STRENGTH_PULL",
      "ENDURANCE_ZONE2",
      "ENDURANCE_TEMPO",
      "ENDURANCE_INTERVALS",
      "HIIT",
      "MOBILITY_RECOVERY",
      "ACTIVE_RECOVERY",
      "REST",
      "CUSTOM",
    ])
    .optional(),
  prescribedDuration: z.number().int().positive().max(300).optional(),
  prescribedTSS: z.number().positive().max(500).optional(),
  status: z
    .enum(["SCHEDULED", "COMPLETED", "MISSED", "SKIPPED", "RESCHEDULED"])
    .optional(),
  content: z.record(z.unknown()).optional(),
  athleteNotes: z.string().max(2000).optional(),
});

export type ClientNotes = z.infer<typeof clientNotesSchema>;
export type CustomMessage = z.infer<typeof customMessageSchema>;
export type WorkoutOverride = z.infer<typeof workoutOverrideSchema>;
