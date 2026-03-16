import bcrypt from "bcryptjs";
import crypto from "crypto";
import { prisma } from "../lib/prisma.js";
import { logger } from "../lib/logger.js";
import { processIntake } from "./ai.service.js";
import { getPlanRecommendations, type PlanRecommendation } from "./plan.service.js";
import type { SimpleIntake, ExpandedIntake } from "../routes/schemas/intake.schemas.js";

/** Normalize a phone number to E.164 format for consistent storage/matching. */
function normalizePhone(phone: string | undefined | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 0) return null;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (phone.startsWith("+")) return phone;
  return `+${digits}`;
}

interface IntakeResult {
  userId: string;
  profileId: string;
  persona: string;
  summary: string;
  planRecommendations: PlanRecommendation[];
}

/** Map simple training_days string to a number */
function mapTrainingDays(days: string): number {
  const map: Record<string, number> = {
    "1-2": 2,
    "2-3": 3,
    "4-5": 5,
    "6+": 6,
  };
  return map[days] ?? 3;
}

/** Generate a random temporary password */
function generateTempPassword(): string {
  return crypto.randomBytes(16).toString("hex");
}

/** Find or create a user by email, returning the user record */
async function findOrCreateUser(
  email: string,
  firstName: string,
  lastName: string
): Promise<{ id: string; isNew: boolean }> {
  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    return { id: existing.id, isNew: false };
  }

  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 12);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      role: "CLIENT",
    },
  });

  logger.info({ userId: user.id, email }, "Created new user from intake (temp password)");
  return { id: user.id, isNew: true };
}

/** Normalize quiz-specific values to canonical values for AI processing */
function normalizeGoal(goal: string): string {
  const map: Record<string, string> = {
    "improve-endurance": "endurance",
    "overall-health": "well-rounded",
  };
  return map[goal] || goal;
}

function normalizeChallenge(challenge: string): string {
  const map: Record<string, string> = {
    "consistency": "structure",
    "nutrition": "energy",
    "motivation": "unsure",
    "time": "structure",
  };
  return map[challenge] || challenge;
}

/** Process a simple intake submission (from the existing quiz flow) */
export async function submitSimpleIntake(data: SimpleIntake): Promise<IntakeResult> {
  const { id: userId, isNew } = await findOrCreateUser(
    data.email,
    data.firstName,
    data.lastName
  );

  const trainingDaysPerWeek = mapTrainingDays(data.training_days);
  const normalizedGoal = normalizeGoal(data.primary_goal);
  const normalizedChallenge = normalizeChallenge(data.challenge);

  const profileData = {
    firstName: data.firstName,
    lastName: data.lastName,
    phone: normalizePhone(data.phone),
    primaryGoal: normalizedGoal,
    secondaryGoals: [] as string[],
    trainingDaysPerWeek,
    experienceLevel: data.experience,
    equipmentAccess: "full-gym" as const,
    biggestChallenge: normalizedChallenge,
    riskFlags: [] as string[],
    recoveryPractices: [] as string[],
  };

  // Upsert AthleteProfile
  const profile = await prisma.athleteProfile.upsert({
    where: { userId },
    create: {
      userId,
      ...profileData,
    },
    update: profileData,
  });

  // Run AI/rule-based classification (use normalized values)
  const aiResult = await processIntake({
    firstName: data.firstName,
    lastName: data.lastName,
    primaryGoal: normalizedGoal,
    experienceLevel: data.experience,
    trainingDaysPerWeek,
    equipmentAccess: "full-gym",
  });

  // Update profile with AI output
  await prisma.athleteProfile.update({
    where: { id: profile.id },
    data: {
      personaType: aiResult.persona,
      aiSummary: aiResult.summary,
      riskFlags: aiResult.riskFlags,
    },
  });

  const planRecommendations = getPlanRecommendations(
    aiResult.persona,
    aiResult.recommendedTier
  );

  logger.info(
    { userId, profileId: profile.id, persona: aiResult.persona, isNew },
    "Simple intake processed"
  );

  return {
    userId,
    profileId: profile.id,
    persona: aiResult.persona,
    summary: aiResult.summary,
    planRecommendations,
  };
}

/** Process an expanded intake submission (full assessment page) */
export async function submitExpandedIntake(data: ExpandedIntake): Promise<IntakeResult> {
  const { id: userId } = await findOrCreateUser(
    data.email,
    data.firstName,
    data.lastName
  );

  const profileData = {
    firstName: data.firstName,
    lastName: data.lastName,
    phone: normalizePhone(data.phone),
    timezone: data.timezone,
    dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
    primaryGoal: data.primaryGoal,
    secondaryGoals: data.secondaryGoals ?? [],
    trainingDaysPerWeek: data.trainingDaysPerWeek,
    preferredTrainingTime: data.preferredTrainingTime ?? null,
    experienceLevel: data.experienceLevel,
    currentActivity: data.currentActivity ?? null,
    equipmentAccess: data.equipmentAccess,
    injuryHistory: data.injuryHistory ?? null,
    sleepSchedule: data.sleepSchedule ?? null,
    stressLevel: data.stressLevel ?? null,
    occupation: data.occupation ?? null,
    travelFrequency: data.travelFrequency ?? null,
    biggestChallenge: data.biggestChallenge ?? null,
    riskFlags: [] as string[],
    recoveryPractices: [] as string[],
  };

  // Upsert AthleteProfile
  const profile = await prisma.athleteProfile.upsert({
    where: { userId },
    create: {
      userId,
      ...profileData,
    },
    update: profileData,
  });

  // Run AI/rule-based classification
  const aiResult = await processIntake({
    firstName: data.firstName,
    lastName: data.lastName,
    primaryGoal: data.primaryGoal,
    experienceLevel: data.experienceLevel,
    trainingDaysPerWeek: data.trainingDaysPerWeek,
    equipmentAccess: data.equipmentAccess,
    occupation: data.occupation,
    stressLevel: data.stressLevel,
    injuryHistory: data.injuryHistory,
    travelFrequency: data.travelFrequency,
    secondaryGoals: data.secondaryGoals,
    preferredTrainingTime: data.preferredTrainingTime,
    currentActivity: data.currentActivity,
    sleepSchedule: data.sleepSchedule,
  });

  // Update profile with AI output
  await prisma.athleteProfile.update({
    where: { id: profile.id },
    data: {
      personaType: aiResult.persona,
      aiSummary: aiResult.summary,
      riskFlags: aiResult.riskFlags,
    },
  });

  const planRecommendations = getPlanRecommendations(
    aiResult.persona,
    aiResult.recommendedTier
  );

  logger.info(
    { userId, profileId: profile.id, persona: aiResult.persona },
    "Expanded intake processed"
  );

  return {
    userId,
    profileId: profile.id,
    persona: aiResult.persona,
    summary: aiResult.summary,
    planRecommendations,
  };
}

/** Retrieve intake results for display on the results page */
export async function getIntakeResults(profileId: string): Promise<{
  persona: string;
  summary: string;
  riskFlags: string[];
  planRecommendations: PlanRecommendation[];
} | null> {
  const profile = await prisma.athleteProfile.findUnique({
    where: { id: profileId },
    select: {
      personaType: true,
      aiSummary: true,
      riskFlags: true,
      firstName: true,
      lastName: true,
    },
  });

  if (!profile || !profile.personaType || !profile.aiSummary) {
    return null;
  }

  const planRecommendations = getPlanRecommendations(profile.personaType);

  return {
    persona: profile.personaType,
    summary: profile.aiSummary,
    riskFlags: profile.riskFlags,
    planRecommendations,
  };
}
