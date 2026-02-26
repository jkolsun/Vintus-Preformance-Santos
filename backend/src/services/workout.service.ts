import type { Prisma, SessionType } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { logger } from "../lib/logger.js";
import {
  pickTemplate,
  applyExperienceModifiers,
  scaleVolume,
  type SessionTemplate,
  type MainExercise,
  type WarmupExercise,
  type CooldownExercise,
} from "../data/exercise-library.js";

/**
 * Workout Service — workout generation, adaptive adjustments, and completion tracking.
 * Core "AI Programming Engine": rule-based logic for decisions, exercise library for content.
 */

// ============================================================
// Types
// ============================================================

interface SessionContent {
  warmup: WarmupExercise[];
  main: MainExercise[];
  cooldown: CooldownExercise[];
  estimatedDuration: number;
  estimatedTSS: number;
}

interface SessionSpec {
  type: SessionType;
  title: string;
}

// ============================================================
// Constants — goal-based session type ratios
// ============================================================

const GOAL_RATIOS: Record<string, { strength: number; endurance: number; hiit: number; mobility: number }> = {
  "build-muscle":   { strength: 0.70, endurance: 0.30, hiit: 0.00, mobility: 0.00 },
  "lose-fat":       { strength: 0.50, endurance: 0.30, hiit: 0.20, mobility: 0.00 },
  endurance:        { strength: 0.30, endurance: 0.60, hiit: 0.00, mobility: 0.10 },
  recomposition:    { strength: 0.60, endurance: 0.25, hiit: 0.15, mobility: 0.00 },
  "well-rounded":   { strength: 0.50, endurance: 0.30, hiit: 0.10, mobility: 0.10 },
};

// Strength session type rotation by training days
const STRENGTH_TYPES_BY_DAYS: Record<number, SessionType[]> = {
  2: ["STRENGTH_FULL", "STRENGTH_FULL"],
  3: ["STRENGTH_FULL", "STRENGTH_FULL", "STRENGTH_FULL"],
  4: ["STRENGTH_UPPER", "STRENGTH_LOWER", "STRENGTH_FULL", "STRENGTH_UPPER"],
  5: ["STRENGTH_UPPER", "STRENGTH_LOWER", "STRENGTH_FULL", "STRENGTH_PUSH", "STRENGTH_PULL"],
  6: ["STRENGTH_PUSH", "STRENGTH_PULL", "STRENGTH_LOWER", "STRENGTH_FULL", "STRENGTH_UPPER", "STRENGTH_LOWER"],
};

const ENDURANCE_TYPES: SessionType[] = ["ENDURANCE_ZONE2", "ENDURANCE_TEMPO", "ENDURANCE_INTERVALS"];

// ============================================================
// Helper: get Monday of the week for a given date
// ============================================================

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  const day = d.getUTCDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  return d;
}

// ============================================================
// Helper: determine block type from week number
// ============================================================

function getBlockType(weekNumber: number): string {
  // Deload every 4th week of each block
  if (weekNumber % 4 === 0) return "deload";
  if (weekNumber <= 4) return "base";
  if (weekNumber <= 8) return "build";
  return "base"; // cycle restarts
}

// ============================================================
// Helper: build session schedule from goal + training days
// ============================================================

function buildSessionSchedule(
  trainingDays: number,
  goal: string
): SessionSpec[] {
  const clamped = Math.min(Math.max(trainingDays, 2), 6);
  const ratios = GOAL_RATIOS[goal] ?? GOAL_RATIOS["well-rounded"];

  // Calculate counts from ratios
  const strengthCount = Math.max(1, Math.round(clamped * ratios.strength));
  const enduranceCount = Math.max(0, Math.round(clamped * ratios.endurance));
  const hiitCount = Math.max(0, Math.round(clamped * ratios.hiit));
  const mobilityCount = Math.max(0, Math.round(clamped * ratios.mobility));

  // Adjust to match exact training days
  let total = strengthCount + enduranceCount + hiitCount + mobilityCount;
  const specs: SessionSpec[] = [];

  // Add strength sessions
  const strengthRotation = STRENGTH_TYPES_BY_DAYS[clamped] ?? STRENGTH_TYPES_BY_DAYS[4];
  for (let i = 0; i < strengthCount && specs.length < clamped; i++) {
    const type = strengthRotation[i % strengthRotation.length];
    specs.push({ type, title: formatSessionTitle(type, i + 1) });
  }

  // Add endurance sessions
  for (let i = 0; i < enduranceCount && specs.length < clamped; i++) {
    const type = i === 0 ? "ENDURANCE_ZONE2" as SessionType : ENDURANCE_TYPES[i % ENDURANCE_TYPES.length];
    specs.push({ type, title: formatSessionTitle(type, i + 1) });
  }

  // Add HIIT sessions
  for (let i = 0; i < hiitCount && specs.length < clamped; i++) {
    specs.push({ type: "HIIT" as SessionType, title: `HIIT Conditioning ${i + 1}` });
  }

  // Add mobility sessions
  for (let i = 0; i < mobilityCount && specs.length < clamped; i++) {
    specs.push({ type: "MOBILITY_RECOVERY" as SessionType, title: "Mobility & Recovery" });
  }

  // If we're still short, add Zone 2; if over, trim
  while (specs.length < clamped) {
    specs.push({ type: "ENDURANCE_ZONE2" as SessionType, title: "Zone 2 Cardio" });
  }
  total = specs.length;
  if (total > clamped) {
    specs.length = clamped;
  }

  return specs;
}

function formatSessionTitle(type: SessionType, index: number): string {
  const labels: Record<string, string> = {
    STRENGTH_UPPER: "Upper Body Strength",
    STRENGTH_LOWER: "Lower Body Strength",
    STRENGTH_FULL: "Full Body Strength",
    STRENGTH_PUSH: "Push Strength",
    STRENGTH_PULL: "Pull Strength",
    ENDURANCE_ZONE2: "Zone 2 Cardio",
    ENDURANCE_TEMPO: "Tempo Work",
    ENDURANCE_INTERVALS: "Interval Training",
    HIIT: "HIIT Conditioning",
    MOBILITY_RECOVERY: "Mobility & Recovery",
    ACTIVE_RECOVERY: "Active Recovery",
  };
  return labels[type] ?? type;
}

// ============================================================
// Helper: build session content from exercise library
// ============================================================

function buildSessionContent(
  sessionType: string,
  equipment: string,
  experienceLevel: string,
  avoidTemplateIds: string[] = [],
  volumeMultiplier: number = 1.0
): { content: SessionContent; templateId: string } {
  const template = pickTemplate(sessionType, equipment, avoidTemplateIds);

  if (!template) {
    // Fallback: generate minimal content
    return {
      content: {
        warmup: [{ exercise: "General Warm-up", duration: "5 min", notes: "Light movement" }],
        main: [{ exercise: "Bodyweight Circuit", sets: 3, reps: "10-15", rest: "60s", intensity: "RPE 6" }],
        cooldown: [{ exercise: "Static Stretch", duration: "5 min" }],
        estimatedDuration: 30,
        estimatedTSS: 30,
      },
      templateId: "fallback",
    };
  }

  // Apply experience modifiers then volume scaling
  let adjustedMain = applyExperienceModifiers(template.main, experienceLevel);
  if (volumeMultiplier !== 1.0) {
    adjustedMain = scaleVolume(adjustedMain, volumeMultiplier);
  }

  // Recalculate estimated TSS based on volume changes
  const totalSets = adjustedMain.reduce((sum, ex) => sum + ex.sets, 0);
  const baseTotalSets = template.main.reduce((sum, ex) => sum + ex.sets, 0);
  const tssRatio = baseTotalSets > 0 ? totalSets / baseTotalSets : 1;

  return {
    content: {
      warmup: template.warmup,
      main: adjustedMain,
      cooldown: template.cooldown,
      estimatedDuration: Math.round(template.estimatedDuration * (0.5 + 0.5 * tssRatio)),
      estimatedTSS: Math.round(template.estimatedTSS * tssRatio),
    },
    templateId: template.id,
  };
}

// ============================================================
// Safety guardrails
// ============================================================

function clampVolumeChange(
  currentTSS: number,
  previousTSS: number
): number {
  if (previousTSS <= 0) return currentTSS;
  const maxIncrease = previousTSS * 1.10; // +10%
  const maxDecrease = previousTSS * 0.60; // -40% (deload level)
  return Math.min(Math.max(currentTSS, maxDecrease), maxIncrease);
}

async function getRecentTemplateIds(profileId: string, weeks: number = 2): Promise<string[]> {
  const since = new Date();
  since.setDate(since.getDate() - weeks * 7);
  since.setUTCHours(0, 0, 0, 0);

  const sessions = await prisma.workoutSession.findMany({
    where: {
      workoutPlan: { athleteProfileId: profileId },
      scheduledDate: { gte: since },
    },
    select: { content: true },
  });

  const ids: string[] = [];
  for (const s of sessions) {
    const content = s.content as Record<string, unknown> | null;
    if (content && typeof content === "object" && "templateId" in content) {
      ids.push(content.templateId as string);
    }
  }
  return ids;
}

function shouldDeload(weekNumber: number): boolean {
  return weekNumber % 4 === 0;
}

// ============================================================
// generateInitialPlan
// ============================================================

export async function generateInitialPlan(
  profileId: string
): Promise<{ planId: string; sessionCount: number }> {
  const profile = await prisma.athleteProfile.findUnique({
    where: { id: profileId },
  });

  if (!profile) {
    const err = new Error("Athlete profile not found") as Error & { statusCode?: number };
    err.statusCode = 404;
    throw err;
  }

  const trainingDays = profile.trainingDaysPerWeek;
  const goal = profile.primaryGoal;
  const equipment = profile.equipmentAccess;
  const experience = profile.experienceLevel;

  // Build session schedule based on goal + training days
  const sessionSpecs = buildSessionSchedule(trainingDays, goal);

  // Calculate start/end dates — start from Monday of current week
  const startDate = getWeekStart(new Date());
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 6);

  // Deactivate any existing active plans
  await prisma.workoutPlan.updateMany({
    where: { athleteProfileId: profileId, isActive: true },
    data: { isActive: false },
  });

  // Build content for each session
  const usedTemplateIds: string[] = [];
  const sessionData = sessionSpecs.map((spec, index) => {
    const { content, templateId } = buildSessionContent(
      spec.type,
      equipment,
      experience,
      usedTemplateIds
    );
    usedTemplateIds.push(templateId);

    // Space sessions across the week (skip rest days based on training count)
    const dayGap = Math.floor(7 / sessionSpecs.length);
    const sessionDate = new Date(startDate);
    sessionDate.setDate(sessionDate.getDate() + Math.min(index * dayGap, 6));

    return {
      scheduledDate: sessionDate,
      scheduledOrder: index + 1,
      sessionType: spec.type as SessionType,
      title: spec.title,
      description: `Week 1, Session ${index + 1} — ${spec.title}. ${experience === "beginner" ? "Focus on form and controlled tempo." : "Push with intent. Controlled reps."}`,
      prescribedDuration: content.estimatedDuration,
      prescribedTSS: content.estimatedTSS,
      content: { ...content, templateId } as unknown as Prisma.InputJsonValue,
      status: "SCHEDULED" as const,
    };
  });

  const plannedTSS = sessionData.reduce((sum, s) => sum + (s.prescribedTSS ?? 0), 0);

  const plan = await prisma.workoutPlan.create({
    data: {
      athleteProfileId: profileId,
      name: "Week 1 — Foundation Phase",
      weekNumber: 1,
      blockType: "base",
      startDate,
      endDate,
      isActive: true,
      plannedTSS,
      sessions: {
        create: sessionData,
      },
    },
  });

  logger.info(
    { profileId, planId: plan.id, sessionCount: sessionSpecs.length, goal, equipment, experience },
    "Initial workout plan generated"
  );

  return { planId: plan.id, sessionCount: sessionSpecs.length };
}

// ============================================================
// generateNextWeek
// ============================================================

export async function generateNextWeek(
  profileId: string
): Promise<{ planId: string; sessionCount: number }> {
  const profile = await prisma.athleteProfile.findUnique({
    where: { id: profileId },
  });

  if (!profile) {
    const err = new Error("Athlete profile not found") as Error & { statusCode?: number };
    err.statusCode = 404;
    throw err;
  }

  // Get current active plan to determine week number
  const currentPlan = await prisma.workoutPlan.findFirst({
    where: { athleteProfileId: profileId, isActive: true },
    orderBy: { weekNumber: "desc" },
    include: { sessions: { select: { prescribedTSS: true } } },
  });

  const previousWeekNumber = currentPlan?.weekNumber ?? 0;
  const nextWeekNumber = previousWeekNumber + 1;
  const blockType = getBlockType(nextWeekNumber);
  const isDeload = blockType === "deload";

  // Get adherence data for the current week
  const weekStart = getWeekStart(new Date());
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const weekSessions = await prisma.workoutSession.findMany({
    where: {
      workoutPlan: { athleteProfileId: profileId },
      scheduledDate: { gte: weekStart, lt: weekEnd },
    },
    select: { status: true },
  });

  const scheduled = weekSessions.length;
  const completed = weekSessions.filter((s) => s.status === "COMPLETED").length;
  const adherenceRate = scheduled > 0 ? completed / scheduled : 0;

  // Get recent readiness to check avg energy
  const twoWeeksAgo = new Date();
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
  const recentReadiness = await prisma.readinessMetric.findMany({
    where: {
      athleteProfileId: profileId,
      date: { gte: twoWeeksAgo },
      source: "MANUAL",
    },
    select: { perceivedEnergy: true, fatigueScore: true },
  });

  const avgEnergy = recentReadiness.length > 0
    ? recentReadiness.reduce((sum, r) => sum + (r.perceivedEnergy ?? 5), 0) / recentReadiness.length
    : 5;

  // Check for sustained high fatigue (deload trigger)
  const recentFatigue = recentReadiness
    .filter((r) => r.fatigueScore != null)
    .map((r) => r.fatigueScore!);
  const highFatigueDays = recentFatigue.filter((f) => f > 70).length;

  // Check for 2 consecutive weeks of low adherence (deload trigger)
  const adherenceRecords = await prisma.adherenceRecord.findMany({
    where: { userId: profile.userId },
    orderBy: { weekStartDate: "desc" },
    take: 2,
    select: { adherenceRate: true },
  });
  const twoWeeksLowAdherence = adherenceRecords.length >= 2 &&
    adherenceRecords.every((r) => r.adherenceRate < 0.5);

  // Determine volume multiplier
  let volumeMultiplier = 1.0;
  if (isDeload || highFatigueDays >= 5 || twoWeeksLowAdherence) {
    volumeMultiplier = 0.60; // deload: -40%
  } else if (adherenceRate > 0.80 && avgEnergy > 6) {
    volumeMultiplier = 1.08; // progressive overload: +5-10%
  } else if (adherenceRate < 0.60) {
    volumeMultiplier = 0.90; // reduce: -10%
  }

  // Clamp against previous week's TSS
  const previousTSS = currentPlan?.sessions.reduce(
    (sum, s) => sum + (s.prescribedTSS ?? 0),
    0
  ) ?? 0;

  // Get recently used template IDs to avoid repeats
  const avoidTemplateIds = await getRecentTemplateIds(profileId, 2);

  // Build session schedule
  const sessionSpecs = buildSessionSchedule(profile.trainingDaysPerWeek, profile.primaryGoal);

  // Calculate dates for next week
  const nextWeekStart = new Date(weekStart);
  nextWeekStart.setDate(nextWeekStart.getDate() + 7);
  const nextWeekEnd = new Date(nextWeekStart);
  nextWeekEnd.setDate(nextWeekEnd.getDate() + 6);

  // Deactivate current active plans
  await prisma.workoutPlan.updateMany({
    where: { athleteProfileId: profileId, isActive: true },
    data: { isActive: false },
  });

  // Build session content with volume adjustments
  const usedIds = [...avoidTemplateIds];
  const sessionData = sessionSpecs.map((spec, index) => {
    const { content, templateId } = buildSessionContent(
      spec.type,
      profile.equipmentAccess,
      profile.experienceLevel,
      usedIds,
      volumeMultiplier
    );
    usedIds.push(templateId);

    const dayGap = Math.floor(7 / sessionSpecs.length);
    const sessionDate = new Date(nextWeekStart);
    sessionDate.setDate(sessionDate.getDate() + Math.min(index * dayGap, 6));

    return {
      scheduledDate: sessionDate,
      scheduledOrder: index + 1,
      sessionType: spec.type as SessionType,
      title: spec.title,
      description: `Week ${nextWeekNumber}, Session ${index + 1} — ${spec.title}.${isDeload ? " Deload week: reduced volume and intensity." : ""}`,
      prescribedDuration: content.estimatedDuration,
      prescribedTSS: content.estimatedTSS,
      content: { ...content, templateId } as unknown as Prisma.InputJsonValue,
      status: "SCHEDULED" as const,
    };
  });

  // Apply safety guardrail: clamp total TSS
  let plannedTSS = sessionData.reduce((sum, s) => sum + (s.prescribedTSS ?? 0), 0);
  if (previousTSS > 0) {
    plannedTSS = clampVolumeChange(plannedTSS, previousTSS);
  }

  const blockLabel = isDeload ? "Deload" : blockType === "build" ? "Build Phase" : "Base Phase";
  const plan = await prisma.workoutPlan.create({
    data: {
      athleteProfileId: profileId,
      name: `Week ${nextWeekNumber} — ${blockLabel}`,
      weekNumber: nextWeekNumber,
      blockType,
      startDate: nextWeekStart,
      endDate: nextWeekEnd,
      isActive: true,
      plannedTSS,
      sessions: {
        create: sessionData,
      },
    },
  });

  logger.info(
    {
      profileId,
      planId: plan.id,
      weekNumber: nextWeekNumber,
      blockType,
      adherenceRate,
      avgEnergy,
      volumeMultiplier,
      sessionCount: sessionSpecs.length,
    },
    "Next week workout plan generated"
  );

  return { planId: plan.id, sessionCount: sessionSpecs.length };
}

// ============================================================
// Adaptive Adjustment: Missed Strength Day
// ============================================================

export async function adjustForMissedStrengthDay(
  planId: string,
  missedSessionId: string
): Promise<void> {
  const plan = await prisma.workoutPlan.findUnique({
    where: { id: planId },
    include: {
      sessions: { orderBy: { scheduledDate: "asc" } },
      athleteProfile: true,
    },
  });

  if (!plan) return;

  const missedSession = plan.sessions.find((s) => s.id === missedSessionId);
  if (!missedSession) return;

  const missedDate = new Date(missedSession.scheduledDate);
  const futureSessions = plan.sessions.filter(
    (s) => new Date(s.scheduledDate) > missedDate && s.status === "SCHEDULED"
  );

  // Count missed strength sessions this week
  const missedStrengthCount = plan.sessions.filter(
    (s) => s.status === "MISSED" && s.sessionType.startsWith("STRENGTH")
  ).length;

  const affectedIds: string[] = [];

  if (missedStrengthCount >= 2) {
    // 2+ missed: consolidate into full-body session on next available slot
    const nextSlot = futureSessions[0];
    if (nextSlot) {
      const { content } = buildSessionContent(
        "STRENGTH_FULL",
        plan.athleteProfile.equipmentAccess,
        plan.athleteProfile.experienceLevel,
        [],
        0.85 // slightly reduced volume
      );

      await prisma.workoutSession.update({
        where: { id: nextSlot.id },
        data: {
          sessionType: "STRENGTH_FULL",
          title: "Consolidated Full Body (Adjusted)",
          description: "Consolidated session after missed strength days. Reduced volume.",
          content: { ...content, templateId: "adjusted" } as unknown as Prisma.InputJsonValue,
          prescribedDuration: content.estimatedDuration,
          prescribedTSS: content.estimatedTSS,
        },
      });
      affectedIds.push(nextSlot.id);
    }
  } else {
    // Check if next day is REST (no session) → swap
    const nextDay = new Date(missedDate);
    nextDay.setDate(nextDay.getDate() + 1);
    const nextDayStr = nextDay.toISOString().split("T")[0];

    const nextDaySession = futureSessions.find(
      (s) => new Date(s.scheduledDate).toISOString().split("T")[0] === nextDayStr
    );

    if (!nextDaySession) {
      // Next day is rest — create a reduced-volume replacement
      const { content } = buildSessionContent(
        missedSession.sessionType,
        plan.athleteProfile.equipmentAccess,
        plan.athleteProfile.experienceLevel,
        [],
        0.85 // -15% volume
      );

      const created = await prisma.workoutSession.create({
        data: {
          workoutPlanId: planId,
          scheduledDate: nextDay,
          scheduledOrder: missedSession.scheduledOrder,
          sessionType: missedSession.sessionType,
          title: `${missedSession.title} (Rescheduled)`,
          description: "Rescheduled from missed day. Volume reduced 15%.",
          prescribedDuration: content.estimatedDuration,
          prescribedTSS: content.estimatedTSS,
          content: { ...content, templateId: "rescheduled" } as unknown as Prisma.InputJsonValue,
          status: "SCHEDULED",
          originalDate: missedSession.scheduledDate,
          rescheduledFrom: missedSession.id,
        },
      });
      affectedIds.push(created.id);
    } else if (!nextDaySession.sessionType.startsWith("STRENGTH")) {
      // Next day is endurance/other — push strength to next available
      const emptySlot = findNextEmptySlot(plan.sessions, missedDate, plan.endDate);
      if (emptySlot) {
        const { content } = buildSessionContent(
          missedSession.sessionType,
          plan.athleteProfile.equipmentAccess,
          plan.athleteProfile.experienceLevel,
          [],
          0.85
        );

        const created = await prisma.workoutSession.create({
          data: {
            workoutPlanId: planId,
            scheduledDate: emptySlot,
            scheduledOrder: missedSession.scheduledOrder,
            sessionType: missedSession.sessionType,
            title: `${missedSession.title} (Rescheduled)`,
            description: "Pushed to next available slot. Volume reduced 15%.",
            prescribedDuration: content.estimatedDuration,
            prescribedTSS: content.estimatedTSS,
            content: { ...content, templateId: "rescheduled" } as unknown as Prisma.InputJsonValue,
            status: "SCHEDULED",
            originalDate: missedSession.scheduledDate,
            rescheduledFrom: missedSession.id,
          },
        });
        affectedIds.push(created.id);
      }
    }
  }

  // Mark original session as MISSED
  await prisma.workoutSession.update({
    where: { id: missedSessionId },
    data: { status: "MISSED" },
  });

  // Log adjustment
  await prisma.adjustmentLog.create({
    data: {
      workoutPlanId: planId,
      triggerEvent: "missed_workout",
      triggerData: {
        missedSessionId,
        sessionType: missedSession.sessionType,
        missedStrengthCount,
      } as unknown as Prisma.InputJsonValue,
      adjustmentType: missedStrengthCount >= 2 ? "swap_session" : "reschedule",
      description: missedStrengthCount >= 2
        ? `Consolidated remaining strength work into full-body session after ${missedStrengthCount}+ missed strength days.`
        : `Rescheduled missed ${missedSession.sessionType} session to next available slot with 15% volume reduction.`,
      affectedSessions: affectedIds,
    },
  });

  logger.info(
    { planId, missedSessionId, missedStrengthCount, affectedIds },
    "Adjusted for missed strength day"
  );
}

// ============================================================
// Adaptive Adjustment: Missed Endurance Day
// ============================================================

export async function adjustForMissedEnduranceDay(
  planId: string,
  missedSessionId: string
): Promise<void> {
  const plan = await prisma.workoutPlan.findUnique({
    where: { id: planId },
    include: {
      sessions: { orderBy: { scheduledDate: "asc" } },
      athleteProfile: true,
    },
  });

  if (!plan) return;

  const missedSession = plan.sessions.find((s) => s.id === missedSessionId);
  if (!missedSession) return;

  const missedDate = new Date(missedSession.scheduledDate);
  const futureSessions = plan.sessions.filter(
    (s) => new Date(s.scheduledDate) > missedDate && s.status === "SCHEDULED"
  );

  const affectedIds: string[] = [];

  // Find next endurance session
  const nextEndurance = futureSessions.find((s) =>
    s.sessionType.startsWith("ENDURANCE")
  );

  if (nextEndurance) {
    // Add 15 min Zone 2 to next endurance session
    const existingContent = nextEndurance.content as Record<string, unknown>;
    const currentDuration = (existingContent.estimatedDuration as number) ?? 30;
    const currentTSS = (existingContent.estimatedTSS as number) ?? 30;

    await prisma.workoutSession.update({
      where: { id: nextEndurance.id },
      data: {
        prescribedDuration: currentDuration + 15,
        prescribedTSS: currentTSS + 12,
        content: {
          ...existingContent,
          estimatedDuration: currentDuration + 15,
          estimatedTSS: currentTSS + 12,
        } as unknown as Prisma.InputJsonValue,
        description: `${nextEndurance.description ?? ""} (Extended +15 min to compensate for missed session)`,
      },
    });
    affectedIds.push(nextEndurance.id);

    // Check if weekend session exists — extend by 20%
    const weekendSessions = futureSessions.filter((s) => {
      const day = new Date(s.scheduledDate).getUTCDay();
      return (day === 0 || day === 6) && s.sessionType.startsWith("ENDURANCE");
    });

    for (const ws of weekendSessions) {
      if (ws.id === nextEndurance.id) continue; // already adjusted
      const wsContent = ws.content as Record<string, unknown>;
      const wsDuration = (wsContent.estimatedDuration as number) ?? 30;
      const wsTSS = (wsContent.estimatedTSS as number) ?? 30;

      await prisma.workoutSession.update({
        where: { id: ws.id },
        data: {
          prescribedDuration: Math.round(wsDuration * 1.2),
          prescribedTSS: Math.round(wsTSS * 1.2),
          content: {
            ...wsContent,
            estimatedDuration: Math.round(wsDuration * 1.2),
            estimatedTSS: Math.round(wsTSS * 1.2),
          } as unknown as Prisma.InputJsonValue,
          description: `${ws.description ?? ""} (Extended 20% — weekend compensation)`,
        },
      });
      affectedIds.push(ws.id);
    }
  } else {
    // No endurance sessions remaining — add 30 min Zone 2 to a rest day
    const emptySlot = findNextEmptySlot(plan.sessions, missedDate, plan.endDate);
    if (emptySlot) {
      const { content } = buildSessionContent(
        "ENDURANCE_ZONE2",
        plan.athleteProfile.equipmentAccess,
        plan.athleteProfile.experienceLevel,
        []
      );
      // Override to 30 min
      content.estimatedDuration = 30;
      content.estimatedTSS = 30;

      const created = await prisma.workoutSession.create({
        data: {
          workoutPlanId: planId,
          scheduledDate: emptySlot,
          scheduledOrder: 99,
          sessionType: "ENDURANCE_ZONE2",
          title: "Zone 2 Cardio (Added)",
          description: "Added Zone 2 session to compensate for missed endurance day.",
          prescribedDuration: 30,
          prescribedTSS: 30,
          content: { ...content, templateId: "compensatory" } as unknown as Prisma.InputJsonValue,
          status: "SCHEDULED",
          originalDate: missedSession.scheduledDate,
          rescheduledFrom: missedSession.id,
        },
      });
      affectedIds.push(created.id);
    }
  }

  // Mark original as MISSED
  await prisma.workoutSession.update({
    where: { id: missedSessionId },
    data: { status: "MISSED" },
  });

  await prisma.adjustmentLog.create({
    data: {
      workoutPlanId: planId,
      triggerEvent: "missed_workout",
      triggerData: {
        missedSessionId,
        sessionType: missedSession.sessionType,
      } as unknown as Prisma.InputJsonValue,
      adjustmentType: nextEndurance ? "reduce_volume" : "add_recovery",
      description: nextEndurance
        ? "Extended next endurance session by 15 min to compensate for missed cardio."
        : "Added 30-min Zone 2 session on rest day to compensate for missed endurance.",
      affectedSessions: affectedIds,
    },
  });

  logger.info(
    { planId, missedSessionId, affectedIds },
    "Adjusted for missed endurance day"
  );
}

// ============================================================
// Adaptive Adjustment: High Fatigue
// ============================================================

export async function adjustForHighFatigue(
  planId: string,
  readinessData: Record<string, unknown>
): Promise<void> {
  const plan = await prisma.workoutPlan.findUnique({
    where: { id: planId },
    include: {
      sessions: { orderBy: { scheduledDate: "asc" } },
      athleteProfile: true,
    },
  });

  if (!plan) return;

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const todaySession = plan.sessions.find(
    (s) =>
      new Date(s.scheduledDate) >= today &&
      new Date(s.scheduledDate) < tomorrow &&
      s.status === "SCHEDULED"
  );

  const affectedIds: string[] = [];

  if (todaySession) {
    if (todaySession.sessionType === "HIIT") {
      // Replace HIIT with mobility/recovery
      const { content } = buildSessionContent(
        "MOBILITY_RECOVERY",
        plan.athleteProfile.equipmentAccess,
        plan.athleteProfile.experienceLevel
      );

      await prisma.workoutSession.update({
        where: { id: todaySession.id },
        data: {
          sessionType: "MOBILITY_RECOVERY",
          title: "Mobility & Recovery (Fatigue Adjustment)",
          description: "HIIT replaced with recovery due to high fatigue. Listen to your body.",
          content: { ...content, templateId: "fatigue-swap" } as unknown as Prisma.InputJsonValue,
          prescribedDuration: content.estimatedDuration,
          prescribedTSS: content.estimatedTSS,
        },
      });
      affectedIds.push(todaySession.id);
    } else if (todaySession.sessionType.startsWith("STRENGTH")) {
      // Reduce strength volume by 25%
      const existingContent = todaySession.content as Record<string, unknown>;
      const existingMain = (existingContent.main as MainExercise[]) ?? [];
      const reducedMain = scaleVolume(existingMain, 0.75);
      const currentTSS = (existingContent.estimatedTSS as number) ?? 50;

      await prisma.workoutSession.update({
        where: { id: todaySession.id },
        data: {
          description: `${todaySession.description ?? ""} (Volume reduced 25% — fatigue detected)`,
          prescribedTSS: Math.round(currentTSS * 0.75),
          content: {
            ...existingContent,
            main: reducedMain,
            estimatedTSS: Math.round(currentTSS * 0.75),
          } as unknown as Prisma.InputJsonValue,
        },
      });
      affectedIds.push(todaySession.id);
    } else if (todaySession.sessionType.startsWith("ENDURANCE")) {
      // Cap at Zone 2
      const existingContent = todaySession.content as Record<string, unknown>;

      await prisma.workoutSession.update({
        where: { id: todaySession.id },
        data: {
          sessionType: "ENDURANCE_ZONE2",
          description: `${todaySession.description ?? ""} (Capped at Zone 2 — fatigue detected)`,
          content: {
            ...existingContent,
            main: (existingContent.main as MainExercise[])?.map((ex) => ({
              ...ex,
              intensity: "Zone 2 (conversational pace)",
              notes: `${ex.notes ?? ""} Fatigue detected — keep effort easy.`.trim(),
            })),
          } as unknown as Prisma.InputJsonValue,
        },
      });
      affectedIds.push(todaySession.id);
    }
  }

  // Check for sustained fatigue (3+ days) → pull deload forward
  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
  threeDaysAgo.setUTCHours(0, 0, 0, 0);

  const recentReadiness = await prisma.readinessMetric.findMany({
    where: {
      athleteProfileId: plan.athleteProfile.id,
      date: { gte: threeDaysAgo },
      source: "MANUAL",
    },
    select: { perceivedEnergy: true, perceivedSoreness: true, fatigueScore: true },
  });

  const sustainedFatigue = recentReadiness.length >= 3 && recentReadiness.every((r) => {
    const highFatigue = (r.fatigueScore != null && r.fatigueScore > 70) ||
      ((r.perceivedEnergy ?? 5) < 4 && (r.perceivedSoreness ?? 5) > 7);
    return highFatigue;
  });

  if (sustainedFatigue) {
    // Pull deload forward — reduce all remaining scheduled sessions
    const remaining = plan.sessions.filter(
      (s) => new Date(s.scheduledDate) > today && s.status === "SCHEDULED"
    );

    for (const session of remaining) {
      if (affectedIds.includes(session.id)) continue;
      const existingContent = session.content as Record<string, unknown>;
      const existingMain = (existingContent.main as MainExercise[]) ?? [];
      const reducedMain = scaleVolume(existingMain, 0.60);
      const currentTSS = (existingContent.estimatedTSS as number) ?? 50;

      await prisma.workoutSession.update({
        where: { id: session.id },
        data: {
          description: `${session.description ?? ""} (Emergency deload — sustained fatigue)`,
          prescribedTSS: Math.round(currentTSS * 0.60),
          content: {
            ...existingContent,
            main: reducedMain,
            estimatedTSS: Math.round(currentTSS * 0.60),
          } as unknown as Prisma.InputJsonValue,
        },
      });
      affectedIds.push(session.id);
    }

    // Update plan block type
    await prisma.workoutPlan.update({
      where: { id: planId },
      data: { blockType: "deload" },
    });
  }

  await prisma.adjustmentLog.create({
    data: {
      workoutPlanId: planId,
      triggerEvent: "high_fatigue",
      triggerData: readinessData as unknown as Prisma.InputJsonValue,
      adjustmentType: sustainedFatigue ? "advance_deload" : todaySession?.sessionType === "HIIT" ? "swap_session" : "reduce_volume",
      description: sustainedFatigue
        ? "Sustained fatigue detected (3+ days). Pulling deload forward — all remaining sessions reduced to 60% volume."
        : `Fatigue detected. ${todaySession?.sessionType === "HIIT" ? "Replaced HIIT with recovery." : "Reduced today's session volume/intensity."}`,
      affectedSessions: affectedIds,
    },
  });

  logger.info(
    { planId, sustainedFatigue, affectedIds },
    "Adjusted for high fatigue"
  );
}

// ============================================================
// Adaptive Adjustment: Low Sleep
// ============================================================

export async function adjustForLowSleep(
  planId: string,
  readinessData: Record<string, unknown>
): Promise<void> {
  const plan = await prisma.workoutPlan.findUnique({
    where: { id: planId },
    include: {
      sessions: { orderBy: { scheduledDate: "asc" } },
      athleteProfile: true,
    },
  });

  if (!plan) return;

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const todaySession = plan.sessions.find(
    (s) =>
      new Date(s.scheduledDate) >= today &&
      new Date(s.scheduledDate) < tomorrow &&
      s.status === "SCHEDULED"
  );

  const affectedIds: string[] = [];

  if (todaySession) {
    // Reduce intensity by 10%
    const existingContent = todaySession.content as Record<string, unknown>;
    const existingMain = (existingContent.main as MainExercise[]) ?? [];
    const reducedMain = scaleVolume(existingMain, 0.90);
    const currentTSS = (existingContent.estimatedTSS as number) ?? 50;

    await prisma.workoutSession.update({
      where: { id: todaySession.id },
      data: {
        description: `${todaySession.description ?? ""} (Reduced 10% — prioritize 8hr sleep tonight)`,
        prescribedTSS: Math.round(currentTSS * 0.90),
        content: {
          ...existingContent,
          main: reducedMain.map((ex) => ({
            ...ex,
            notes: `${ex.notes ?? ""} Priority: get 8 hours of sleep tonight.`.trim(),
          })),
          estimatedTSS: Math.round(currentTSS * 0.90),
        } as unknown as Prisma.InputJsonValue,
      },
    });
    affectedIds.push(todaySession.id);
  }

  // Check for consecutive low sleep → replace next HIIT
  const twoDaysAgo = new Date();
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
  twoDaysAgo.setUTCHours(0, 0, 0, 0);

  const recentSleep = await prisma.readinessMetric.findMany({
    where: {
      athleteProfileId: plan.athleteProfile.id,
      date: { gte: twoDaysAgo },
      source: "MANUAL",
    },
    select: { sleepQualityManual: true, sleepScore: true, sleepDurationMin: true },
  });

  const consecutiveLowSleep = recentSleep.length >= 2 && recentSleep.every((r) =>
    (r.sleepScore != null && r.sleepScore < 50) ||
    (r.sleepQualityManual != null && r.sleepQualityManual < 4) ||
    (r.sleepDurationMin != null && r.sleepDurationMin < 360)
  );

  if (consecutiveLowSleep) {
    // Replace next HIIT with active recovery
    const nextHiit = plan.sessions.find(
      (s) =>
        new Date(s.scheduledDate) > today &&
        s.status === "SCHEDULED" &&
        s.sessionType === "HIIT" &&
        !affectedIds.includes(s.id)
    );

    if (nextHiit) {
      const { content } = buildSessionContent(
        "ACTIVE_RECOVERY",
        plan.athleteProfile.equipmentAccess,
        plan.athleteProfile.experienceLevel
      );

      await prisma.workoutSession.update({
        where: { id: nextHiit.id },
        data: {
          sessionType: "ACTIVE_RECOVERY",
          title: "Active Recovery (Sleep Adjustment)",
          description: "HIIT replaced with active recovery due to consecutive low sleep nights.",
          content: { ...content, templateId: "sleep-swap" } as unknown as Prisma.InputJsonValue,
          prescribedDuration: content.estimatedDuration,
          prescribedTSS: content.estimatedTSS,
        },
      });
      affectedIds.push(nextHiit.id);
    }
  }

  await prisma.adjustmentLog.create({
    data: {
      workoutPlanId: planId,
      triggerEvent: "low_sleep",
      triggerData: readinessData as unknown as Prisma.InputJsonValue,
      adjustmentType: consecutiveLowSleep ? "swap_session" : "reduce_intensity",
      description: consecutiveLowSleep
        ? "2+ consecutive low sleep nights. Replaced next HIIT with active recovery. Reduced today's intensity."
        : "Low sleep detected. Reduced today's session intensity by 10%. Prioritize sleep tonight.",
      affectedSessions: affectedIds,
    },
  });

  logger.info(
    { planId, consecutiveLowSleep, affectedIds },
    "Adjusted for low sleep"
  );
}

// ============================================================
// Adaptive Adjustment: Travel Week
// ============================================================

export async function adjustForTravelWeek(
  profileId: string
): Promise<void> {
  const profile = await prisma.athleteProfile.findUnique({
    where: { id: profileId },
    include: {
      workoutPlans: {
        where: { isActive: true },
        orderBy: { weekNumber: "desc" },
        take: 1,
        include: { sessions: { orderBy: { scheduledDate: "asc" } } },
      },
    },
  });

  if (!profile || profile.workoutPlans.length === 0) return;

  const plan = profile.workoutPlans[0];
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  // Get scheduled sessions from today forward
  const futureSessions = plan.sessions.filter(
    (s) => new Date(s.scheduledDate) >= today && s.status === "SCHEDULED"
  );

  const affectedIds: string[] = [];

  // Reduce to max 3 sessions
  const maxTravelSessions = 3;
  const sessionsToKeep = futureSessions.slice(0, maxTravelSessions);
  const sessionsToCancel = futureSessions.slice(maxTravelSessions);

  // Cancel excess sessions
  for (const session of sessionsToCancel) {
    await prisma.workoutSession.update({
      where: { id: session.id },
      data: { status: "SKIPPED", athleteNotes: "Cancelled for travel week" },
    });
    affectedIds.push(session.id);
  }

  // Convert remaining sessions to bodyweight/travel-friendly
  let hasEndurance = false;
  for (const session of sessionsToKeep) {
    if (session.sessionType.startsWith("ENDURANCE")) {
      // Keep one endurance session as-is (running = no equipment)
      if (!hasEndurance) {
        hasEndurance = true;
        // Ensure it's a run (no equipment needed)
        const { content } = buildSessionContent(
          "ENDURANCE_ZONE2",
          "bodyweight-only",
          profile.experienceLevel
        );
        await prisma.workoutSession.update({
          where: { id: session.id },
          data: {
            sessionType: "ENDURANCE_ZONE2",
            title: "Zone 2 Run (Travel)",
            description: "Maintained cardio session — running requires no equipment.",
            content: { ...content, templateId: "travel-endurance" } as unknown as Prisma.InputJsonValue,
            prescribedDuration: content.estimatedDuration,
          },
        });
        affectedIds.push(session.id);
        continue;
      }
    }

    // Replace gym sessions with bodyweight
    if (session.sessionType.startsWith("STRENGTH") || session.sessionType === "HIIT") {
      const bwType = session.sessionType.startsWith("STRENGTH")
        ? session.sessionType
        : "STRENGTH_FULL";

      const { content } = buildSessionContent(
        bwType,
        "bodyweight-only",
        profile.experienceLevel,
        [],
        0.85 // slightly reduced for travel
      );

      await prisma.workoutSession.update({
        where: { id: session.id },
        data: {
          title: `${session.title} (Travel — Bodyweight)`,
          description: "Converted to bodyweight for hotel/travel. No equipment needed.",
          content: { ...content, templateId: "travel-bw" } as unknown as Prisma.InputJsonValue,
          prescribedDuration: content.estimatedDuration,
          prescribedTSS: content.estimatedTSS,
        },
      });
      affectedIds.push(session.id);
    }
  }

  await prisma.adjustmentLog.create({
    data: {
      workoutPlanId: plan.id,
      triggerEvent: "travel_week",
      triggerData: {
        profileId,
        travelFrequency: profile.travelFrequency,
        originalSessionCount: futureSessions.length,
        adjustedSessionCount: sessionsToKeep.length,
      } as unknown as Prisma.InputJsonValue,
      adjustmentType: "swap_session",
      description: `Travel week adjustment: reduced from ${futureSessions.length} to ${sessionsToKeep.length} sessions. Gym exercises replaced with bodyweight alternatives.`,
      affectedSessions: affectedIds,
    },
  });

  logger.info(
    { profileId, planId: plan.id, affectedIds, keptSessions: sessionsToKeep.length },
    "Adjusted for travel week"
  );
}

// ============================================================
// Helpers
// ============================================================

function findNextEmptySlot(
  sessions: { scheduledDate: Date; status: string }[],
  afterDate: Date,
  planEndDate: Date
): Date | null {
  const scheduledDates = new Set(
    sessions
      .filter((s) => s.status !== "MISSED" && s.status !== "SKIPPED")
      .map((s) => new Date(s.scheduledDate).toISOString().split("T")[0])
  );

  const cursor = new Date(afterDate);
  cursor.setDate(cursor.getDate() + 1);

  while (cursor <= planEndDate) {
    const dateStr = cursor.toISOString().split("T")[0];
    if (!scheduledDates.has(dateStr)) {
      return new Date(cursor);
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return null;
}
