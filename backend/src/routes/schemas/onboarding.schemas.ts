import { z } from "zod";

const hhmmRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const verifySessionSchema = z.object({
  sessionId: z.string().min(1, "sessionId is required"),
});

export const setPasswordSchema = z.object({
  userId: z.string().min(1, "userId is required"),
  sessionId: z.string().min(1, "sessionId is required"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least 1 uppercase letter")
    .regex(/[0-9]/, "Password must contain at least 1 number"),
});

export const routineQuestionnaireSchema = z.object({
  wakeTime: z.string().regex(hhmmRegex, "wakeTime must be HH:MM format"),
  bedTime: z.string().regex(hhmmRegex, "bedTime must be HH:MM format"),
  mealsPerDay: z.number().int().min(1).max(8),
  hydrationLevel: z.enum(["low", "moderate", "good"]),
  supplementsUsed: z.string().optional(),
  recoveryPractices: z.array(
    z.enum(["foam-roll", "stretch", "sauna", "cold-plunge", "massage", "none"])
  ),
  typicalEnergyLevel: z.number().int().min(1).max(10),
  typicalSorenessLevel: z.number().int().min(1).max(10),
  typicalMoodLevel: z.number().int().min(1).max(10),
  typicalSleepQuality: z.number().int().min(1).max(10),
});

export const deviceSelectionSchema = z.object({
  provider: z.enum(["STRAVA", "GARMIN", "APPLE_HEALTH", "WHOOP", "OURA", "FITBIT"]),
});

export type VerifySession = z.infer<typeof verifySessionSchema>;
export type SetPassword = z.infer<typeof setPasswordSchema>;
export type RoutineQuestionnaire = z.infer<typeof routineQuestionnaireSchema>;
export type DeviceSelection = z.infer<typeof deviceSelectionSchema>;
