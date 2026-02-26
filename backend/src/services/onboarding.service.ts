import jwt, { type SignOptions, type Secret } from "jsonwebtoken";
import bcrypt from "bcryptjs";
import type { DataSource } from "@prisma/client";
import { stripe } from "../config/stripe.js";
import { prisma } from "../lib/prisma.js";
import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";
import { generateInitialPlan } from "./workout.service.js";
import type { RoutineQuestionnaire } from "../routes/schemas/onboarding.schemas.js";

const SALT_ROUNDS = 12;

// ============================================================
// JWT helpers (same logic as auth.service — kept local to avoid circular deps)
// ============================================================

interface TokenPayload {
  userId: string;
  email: string;
  role: string;
}

function signToken(payload: TokenPayload): string {
  const secret: Secret = env.JWT_SECRET;
  const options: SignOptions = {
    expiresIn: env.JWT_EXPIRES_IN as unknown as SignOptions["expiresIn"],
  };
  return jwt.sign(payload, secret, options);
}

function getTokenExpiry(): Date {
  const match = env.JWT_EXPIRES_IN.match(/^(\d+)([dhms])$/);
  const now = Date.now();
  if (!match) return new Date(now + 7 * 24 * 60 * 60 * 1000);
  const value = parseInt(match[1], 10);
  const unit = match[2];
  const multipliers: Record<string, number> = {
    d: 24 * 60 * 60 * 1000,
    h: 60 * 60 * 1000,
    m: 60 * 1000,
    s: 1000,
  };
  return new Date(now + value * (multipliers[unit] ?? 0));
}

// ============================================================
// verifyCheckoutSession
// ============================================================

export async function verifyCheckoutSession(
  stripeSessionId: string
): Promise<{ userId: string; tier: string; email: string }> {
  const session = await stripe.checkout.sessions.retrieve(stripeSessionId);

  if (session.status !== "complete") {
    const err = new Error("Checkout session is not complete") as Error & { statusCode?: number };
    err.statusCode = 400;
    throw err;
  }

  const userId = session.metadata?.userId;
  const tier = session.metadata?.tier;

  if (!userId || !tier) {
    const err = new Error("Checkout session missing metadata") as Error & { statusCode?: number };
    err.statusCode = 400;
    throw err;
  }

  const email =
    session.customer_details?.email ??
    session.customer_email ??
    "";

  logger.info({ userId, tier, stripeSessionId }, "Checkout session verified");

  return { userId, tier, email };
}

// ============================================================
// setInitialPassword
// ============================================================

export async function setInitialPassword(
  userId: string,
  stripeSessionId: string,
  newPassword: string
): Promise<{ token: string }> {
  // Verify the Stripe session belongs to this user
  const session = await stripe.checkout.sessions.retrieve(stripeSessionId);

  if (session.metadata?.userId !== userId) {
    const err = new Error("Session does not match user") as Error & { statusCode?: number };
    err.statusCode = 403;
    throw err;
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user) {
    const err = new Error("User not found") as Error & { statusCode?: number };
    err.statusCode = 404;
    throw err;
  }

  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
  });

  // Create session + JWT so user is immediately logged in
  const token = signToken({ userId: user.id, email: user.email, role: user.role });

  await prisma.session.create({
    data: {
      userId: user.id,
      token,
      expiresAt: getTokenExpiry(),
    },
  });

  logger.info({ userId }, "Initial password set during onboarding");

  return { token };
}

// ============================================================
// submitRoutineQuestionnaire
// ============================================================

export async function submitRoutineQuestionnaire(
  userId: string,
  data: RoutineQuestionnaire
): Promise<{ planId: string; sessionCount: number }> {
  const profile = await prisma.athleteProfile.findUnique({
    where: { userId },
  });

  if (!profile) {
    const err = new Error("Athlete profile not found") as Error & { statusCode?: number };
    err.statusCode = 404;
    throw err;
  }

  // Update AthleteProfile with routine fields
  await prisma.athleteProfile.update({
    where: { id: profile.id },
    data: {
      wakeTime: data.wakeTime,
      bedTime: data.bedTime,
      mealsPerDay: data.mealsPerDay,
      hydrationLevel: data.hydrationLevel,
      supplementsUsed: data.supplementsUsed ?? null,
      recoveryPractices: data.recoveryPractices,
    },
  });

  // Create initial ReadinessMetric as baseline
  await prisma.readinessMetric.create({
    data: {
      athleteProfileId: profile.id,
      date: new Date(),
      source: "MANUAL",
      perceivedEnergy: data.typicalEnergyLevel,
      perceivedSoreness: data.typicalSorenessLevel,
      perceivedMood: data.typicalMoodLevel,
      sleepQualityManual: data.typicalSleepQuality,
      notes: "Baseline from onboarding questionnaire",
    },
  });

  // Generate initial workout plan
  const plan = await generateInitialPlan(profile.id);

  logger.info(
    { userId, profileId: profile.id, planId: plan.planId },
    "Onboarding routine completed, initial plan generated"
  );

  return plan;
}

// ============================================================
// initiateDeviceConnection (MVP: pending record, no OAuth)
// ============================================================

export async function initiateDeviceConnection(
  userId: string,
  provider: DataSource
): Promise<{ provider: string; status: string; setupUrl: string | null }> {
  // Upsert so repeated calls don't create duplicates
  await prisma.deviceConnection.upsert({
    where: {
      userId_provider: { userId, provider },
    },
    create: {
      userId,
      provider,
      isActive: false,
      scopes: [],
    },
    update: {
      // No-op — just ensure it exists
    },
  });

  logger.info({ userId, provider }, "Device connection initiated (pending)");

  return {
    provider,
    status: "pending",
    setupUrl: null, // Phase 2: OAuth URL
  };
}

// ============================================================
// getOnboardingStatus
// ============================================================

export async function getOnboardingStatus(userId: string): Promise<{
  passwordSet: boolean;
  deviceConnected: boolean;
  routineCompleted: boolean;
  planGenerated: boolean;
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      sessions: { take: 1 },
      athleteProfile: {
        include: {
          workoutPlans: { take: 1 },
        },
      },
      deviceConnections: { where: { isActive: true }, take: 1 },
    },
  });

  if (!user) {
    const err = new Error("User not found") as Error & { statusCode?: number };
    err.statusCode = 404;
    throw err;
  }

  // Password is "set" if user has at least one session (meaning they logged in / set password)
  const passwordSet = (user.sessions?.length ?? 0) > 0;

  // Device is connected if any active DeviceConnection exists
  const deviceConnected = (user.deviceConnections?.length ?? 0) > 0;

  // Routine is completed if wakeTime is set (required field from questionnaire)
  const routineCompleted = user.athleteProfile?.wakeTime != null;

  // Plan is generated if at least one WorkoutPlan exists
  const planGenerated = (user.athleteProfile?.workoutPlans?.length ?? 0) > 0;

  return { passwordSet, deviceConnected, routineCompleted, planGenerated };
}
