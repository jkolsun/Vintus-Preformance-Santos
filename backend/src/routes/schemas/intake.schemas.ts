import { z } from "zod";

const goalEnum = z.enum([
  "build-muscle",
  "lose-fat",
  "endurance",
  "well-rounded",
  "recomposition",
  "other",
]);

export const simpleIntakeSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Must be a valid email address"),
  phone: z.string().optional(),
  primary_goal: goalEnum,
  training_days: z.enum(["1-2", "2-3", "4-5", "6+"]),
  experience: z.enum(["beginner", "intermediate", "advanced"]),
  challenge: z.enum(["structure", "no-results", "energy", "unsure"]),
});

export const expandedIntakeSchema = z.object({
  // Contact
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Must be a valid email address"),
  phone: z.string().optional(),

  // Demographics
  dateOfBirth: z.string().datetime({ offset: true }).optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
  occupation: z.string().optional(),
  timezone: z.string().default("America/New_York"),

  // Goals
  primaryGoal: goalEnum,
  secondaryGoals: z.array(z.string()).optional().default([]),

  // Training context
  trainingDaysPerWeek: z.number().int().min(1).max(7),
  preferredTrainingTime: z.enum(["morning", "midday", "evening"]).optional(),
  experienceLevel: z.enum(["beginner", "intermediate", "advanced", "elite"]),
  currentActivity: z.string().optional(),
  equipmentAccess: z.enum(["full-gym", "home-gym", "minimal", "bodyweight-only"]),

  // Health & recovery
  injuryHistory: z.string().optional(),
  sleepSchedule: z.string().optional(),
  stressLevel: z.number().int().min(1).max(10).optional(),

  // Lifestyle
  travelFrequency: z.enum(["rarely", "monthly", "weekly"]).optional(),
  biggestChallenge: z.string().optional(),
});

export type SimpleIntake = z.infer<typeof simpleIntakeSchema>;
export type ExpandedIntake = z.infer<typeof expandedIntakeSchema>;
