import { prisma } from "../lib/prisma.js";
import { logger } from "../lib/logger.js";
import type { CheckinInput } from "../routes/schemas/readiness.schemas.js";

// ============================================================
// submitCheckin — upsert today's readiness + evaluate flags
// ============================================================

export async function submitCheckin(
  userId: string,
  data: CheckinInput
): Promise<{ id: string; flagged: boolean; flags: string[] }> {
  const profile = await prisma.athleteProfile.findUnique({
    where: { userId },
  });

  if (!profile) {
    const err = new Error("Athlete profile not found") as Error & { statusCode?: number };
    err.statusCode = 404;
    throw err;
  }

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const metric = await prisma.readinessMetric.upsert({
    where: {
      athleteProfileId_date_source: {
        athleteProfileId: profile.id,
        date: today,
        source: "MANUAL",
      },
    },
    create: {
      athleteProfileId: profile.id,
      date: today,
      source: "MANUAL",
      perceivedEnergy: data.perceivedEnergy,
      perceivedSoreness: data.perceivedSoreness,
      perceivedMood: data.perceivedMood,
      sleepQualityManual: data.sleepQualityManual,
      sleepDurationMin: data.sleepDurationMin ?? null,
      bodyWeight: data.bodyWeight ?? null,
      notes: data.notes ?? null,
    },
    update: {
      perceivedEnergy: data.perceivedEnergy,
      perceivedSoreness: data.perceivedSoreness,
      perceivedMood: data.perceivedMood,
      sleepQualityManual: data.sleepQualityManual,
      sleepDurationMin: data.sleepDurationMin ?? null,
      bodyWeight: data.bodyWeight ?? null,
      notes: data.notes ?? null,
    },
  });

  // Evaluate readiness flags
  const flags: string[] = [];

  if (data.perceivedEnergy < 4 && data.perceivedSoreness > 7) {
    flags.push("high_fatigue");
  }
  if (data.sleepQualityManual < 4) {
    flags.push("low_sleep");
  }

  const flagged = flags.length > 0;

  if (flagged) {
    logger.warn({ userId, flags, metricId: metric.id }, "Readiness flags triggered");
  }

  logger.info({ userId, metricId: metric.id, flagged }, "Readiness check-in submitted");

  return { id: metric.id, flagged, flags };
}

// ============================================================
// getHistory — last N days of readiness data
// ============================================================

export async function getHistory(
  userId: string,
  days: number
): Promise<unknown[]> {
  const profile = await prisma.athleteProfile.findUnique({
    where: { userId },
  });

  if (!profile) {
    return [];
  }

  const sinceDate = new Date();
  sinceDate.setUTCHours(0, 0, 0, 0);
  sinceDate.setDate(sinceDate.getDate() - days);

  const metrics = await prisma.readinessMetric.findMany({
    where: {
      athleteProfileId: profile.id,
      date: { gte: sinceDate },
    },
    orderBy: { date: "desc" },
    select: {
      id: true,
      date: true,
      source: true,
      perceivedEnergy: true,
      perceivedSoreness: true,
      perceivedMood: true,
      sleepQualityManual: true,
      sleepDurationMin: true,
      bodyWeight: true,
      hrvMs: true,
      sleepScore: true,
      notes: true,
      createdAt: true,
    },
  });

  return metrics;
}

// ============================================================
// getTrends — last 14 days vs previous 14 days
// ============================================================

export async function getTrends(userId: string): Promise<{
  avgEnergy: number;
  avgSoreness: number;
  avgMood: number;
  avgSleep: number;
  trend: "improving" | "declining" | "stable";
}> {
  const profile = await prisma.athleteProfile.findUnique({
    where: { userId },
  });

  if (!profile) {
    return { avgEnergy: 0, avgSoreness: 0, avgMood: 0, avgSleep: 0, trend: "stable" };
  }

  const now = new Date();
  now.setUTCHours(0, 0, 0, 0);

  const fourteenDaysAgo = new Date(now);
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  const twentyEightDaysAgo = new Date(now);
  twentyEightDaysAgo.setDate(twentyEightDaysAgo.getDate() - 28);

  const [recentMetrics, previousMetrics] = await Promise.all([
    prisma.readinessMetric.findMany({
      where: {
        athleteProfileId: profile.id,
        date: { gte: fourteenDaysAgo },
        source: "MANUAL",
      },
    }),
    prisma.readinessMetric.findMany({
      where: {
        athleteProfileId: profile.id,
        date: { gte: twentyEightDaysAgo, lt: fourteenDaysAgo },
        source: "MANUAL",
      },
    }),
  ]);

  const recentAvg = calculateAverages(recentMetrics);
  const previousAvg = calculateAverages(previousMetrics);

  // Determine trend: compare composite scores
  const recentComposite = recentAvg.energy + recentAvg.mood + recentAvg.sleep - recentAvg.soreness;
  const previousComposite = previousAvg.energy + previousAvg.mood + previousAvg.sleep - previousAvg.soreness;

  let trend: "improving" | "declining" | "stable" = "stable";
  const diff = recentComposite - previousComposite;

  if (previousMetrics.length === 0) {
    trend = "stable";
  } else if (diff > 2) {
    trend = "improving";
  } else if (diff < -2) {
    trend = "declining";
  }

  return {
    avgEnergy: recentAvg.energy,
    avgSoreness: recentAvg.soreness,
    avgMood: recentAvg.mood,
    avgSleep: recentAvg.sleep,
    trend,
  };
}

function calculateAverages(metrics: Array<{
  perceivedEnergy: number | null;
  perceivedSoreness: number | null;
  perceivedMood: number | null;
  sleepQualityManual: number | null;
}>): { energy: number; soreness: number; mood: number; sleep: number } {
  if (metrics.length === 0) {
    return { energy: 0, soreness: 0, mood: 0, sleep: 0 };
  }

  let energySum = 0, energyCount = 0;
  let sorenessSum = 0, sorenessCount = 0;
  let moodSum = 0, moodCount = 0;
  let sleepSum = 0, sleepCount = 0;

  for (const m of metrics) {
    if (m.perceivedEnergy != null) { energySum += m.perceivedEnergy; energyCount++; }
    if (m.perceivedSoreness != null) { sorenessSum += m.perceivedSoreness; sorenessCount++; }
    if (m.perceivedMood != null) { moodSum += m.perceivedMood; moodCount++; }
    if (m.sleepQualityManual != null) { sleepSum += m.sleepQualityManual; sleepCount++; }
  }

  return {
    energy: energyCount > 0 ? Math.round((energySum / energyCount) * 10) / 10 : 0,
    soreness: sorenessCount > 0 ? Math.round((sorenessSum / sorenessCount) * 10) / 10 : 0,
    mood: moodCount > 0 ? Math.round((moodSum / moodCount) * 10) / 10 : 0,
    sleep: sleepCount > 0 ? Math.round((sleepSum / sleepCount) * 10) / 10 : 0,
  };
}
