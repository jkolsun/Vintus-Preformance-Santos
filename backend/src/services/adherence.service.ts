import { prisma } from "../lib/prisma.js";
import { logger } from "../lib/logger.js";

// ============================================================
// Helper: get Monday of the week for a given date
// ============================================================

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  const day = d.getUTCDay();
  // Move to Monday (day 1). If Sunday (0), go back 6 days.
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  return d;
}

// ============================================================
// updateAdherence — recalculate for a given week
// ============================================================

export async function updateAdherence(
  userId: string,
  weekStartDate: Date
): Promise<void> {
  const weekStart = getWeekStart(weekStartDate);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  // Find the user's athlete profile
  const profile = await prisma.athleteProfile.findUnique({
    where: { userId },
  });

  if (!profile) return;

  // Count sessions for this week across all active plans
  const sessions = await prisma.workoutSession.findMany({
    where: {
      workoutPlan: { athleteProfileId: profile.id },
      scheduledDate: { gte: weekStart, lt: weekEnd },
    },
    select: { status: true },
  });

  const scheduledCount = sessions.length;
  const completedCount = sessions.filter((s) => s.status === "COMPLETED").length;
  const missedCount = sessions.filter((s) => s.status === "MISSED").length;
  const skippedCount = sessions.filter((s) => s.status === "SKIPPED").length;
  const adherenceRate = scheduledCount > 0 ? completedCount / scheduledCount : 0;

  // Get consecutive missed count
  const consecutiveMissed = await getConsecutiveMissed(userId);

  // Check if escalation should trigger
  const escalationTriggered = await checkEscalationThreshold(userId);

  await prisma.adherenceRecord.upsert({
    where: {
      userId_weekStartDate: { userId, weekStartDate: weekStart },
    },
    create: {
      userId,
      weekStartDate: weekStart,
      scheduledCount,
      completedCount,
      missedCount,
      skippedCount,
      adherenceRate,
      consecutiveMissed,
      escalationTriggered,
    },
    update: {
      scheduledCount,
      completedCount,
      missedCount,
      skippedCount,
      adherenceRate,
      consecutiveMissed,
      escalationTriggered,
    },
  });

  logger.info(
    { userId, weekStart: weekStart.toISOString(), adherenceRate, completedCount, scheduledCount },
    "Adherence record updated"
  );
}

// ============================================================
// getConsecutiveMissed — walk backward from today
// ============================================================

export async function getConsecutiveMissed(userId: string): Promise<number> {
  const profile = await prisma.athleteProfile.findUnique({
    where: { userId },
  });

  if (!profile) return 0;

  // Get recent sessions ordered by date desc
  const recentSessions = await prisma.workoutSession.findMany({
    where: {
      workoutPlan: { athleteProfileId: profile.id },
      scheduledDate: { lte: new Date() },
    },
    orderBy: { scheduledDate: "desc" },
    take: 30,
    select: { status: true, scheduledDate: true },
  });

  let streak = 0;
  for (const session of recentSessions) {
    if (session.status === "MISSED" || session.status === "SKIPPED") {
      streak++;
    } else if (session.status === "COMPLETED") {
      break;
    } else {
      // SCHEDULED sessions in the past that haven't been acted on count as missed
      break;
    }
  }

  return streak;
}

// ============================================================
// checkEscalationThreshold — 3+ missed in rolling 7 days
// ============================================================

export async function checkEscalationThreshold(userId: string): Promise<boolean> {
  const profile = await prisma.athleteProfile.findUnique({
    where: { userId },
  });

  if (!profile) return false;

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  sevenDaysAgo.setUTCHours(0, 0, 0, 0);

  const missedCount = await prisma.workoutSession.count({
    where: {
      workoutPlan: { athleteProfileId: profile.id },
      scheduledDate: { gte: sevenDaysAgo, lte: new Date() },
      status: { in: ["MISSED", "SKIPPED"] },
    },
  });

  return missedCount >= 3;
}

// ============================================================
// getAdherenceHistory — last N weeks
// ============================================================

export async function getAdherenceHistory(
  userId: string,
  weeks: number
): Promise<unknown[]> {
  const sinceDate = new Date();
  sinceDate.setUTCHours(0, 0, 0, 0);
  sinceDate.setDate(sinceDate.getDate() - weeks * 7);

  const records = await prisma.adherenceRecord.findMany({
    where: {
      userId,
      weekStartDate: { gte: sinceDate },
    },
    orderBy: { weekStartDate: "desc" },
  });

  return records;
}

// ============================================================
// getCurrentWeekAdherence — helper for dashboard
// ============================================================

export async function getCurrentWeekAdherence(userId: string): Promise<{
  adherenceRate: number;
  completedCount: number;
  scheduledCount: number;
}> {
  const profile = await prisma.athleteProfile.findUnique({
    where: { userId },
  });

  if (!profile) {
    return { adherenceRate: 0, completedCount: 0, scheduledCount: 0 };
  }

  const weekStart = getWeekStart(new Date());
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const sessions = await prisma.workoutSession.findMany({
    where: {
      workoutPlan: { athleteProfileId: profile.id },
      scheduledDate: { gte: weekStart, lt: weekEnd },
    },
    select: { status: true },
  });

  const scheduledCount = sessions.length;
  const completedCount = sessions.filter((s) => s.status === "COMPLETED").length;
  const adherenceRate = scheduledCount > 0 ? completedCount / scheduledCount : 0;

  return { adherenceRate, completedCount, scheduledCount };
}
