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

export const profileEditSchema = z.object({
  primaryGoal: z.string().min(1).max(100).optional(),
  trainingDaysPerWeek: z.number().int().min(1).max(7).optional(),
  experienceLevel: z.string().min(1).max(50).optional(),
  equipmentAccess: z.string().min(1).max(50).optional(),
  injuryHistory: z.string().max(1000).optional().nullable(),
  stressLevel: z.number().int().min(1).max(10).optional(),
  preferredTrainingTime: z.string().min(1).max(20).optional(),
  timezone: z.string().min(1).max(50).optional(),
  messagingDisabled: z.boolean().optional(),
});

export const clientStatusSchema = z.object({
  action: z.enum(["pause", "activate", "approve", "reject"]),
});

export const changeTierSchema = z.object({
  tier: z.enum(["PRIVATE_COACHING", "TRAINING_30DAY", "TRAINING_60DAY", "TRAINING_90DAY", "NUTRITION_4WEEK", "NUTRITION_8WEEK"]),
});

export const extendSubscriptionSchema = z.object({
  days: z.number().int().min(1).max(365),
});

export const resolveEscalationSchema = z.object({
  resolution: z.enum(["resumed", "paused_subscription", "churned", "call_completed", "other"]),
});

export type ClientStatus = z.infer<typeof clientStatusSchema>;
export type ClientNotes = z.infer<typeof clientNotesSchema>;
export type CustomMessage = z.infer<typeof customMessageSchema>;
export type WorkoutOverride = z.infer<typeof workoutOverrideSchema>;
export type ProfileEdit = z.infer<typeof profileEditSchema>;
