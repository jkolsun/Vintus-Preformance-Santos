import { prisma } from "../lib/prisma.js";
import { getCurrentWeekAdherence } from "./adherence.service.js";

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
// getOverview — full dashboard aggregation
// ============================================================

export async function getOverview(userId: string): Promise<unknown> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      athleteProfile: true,
      subscription: { select: { planTier: true, status: true } },
    },
  });

  if (!user?.athleteProfile) {
    const err = new Error("Athlete profile not found") as Error & { statusCode?: number };
    err.statusCode = 404;
    throw err;
  }

  const profile = user.athleteProfile;
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Parallel data fetching
  const [
    todayWorkout,
    todayReadiness,
    activePlan,
    weekSessions,
    weekAdherence,
    streakData,
    recentMessages,
  ] = await Promise.all([
    // Today's workout
    prisma.workoutSession.findFirst({
      where: {
        workoutPlan: { athleteProfileId: profile.id },
        scheduledDate: { gte: today, lt: tomorrow },
      },
      include: { workoutPlan: { select: { name: true } } },
    }),

    // Today's readiness
    prisma.readinessMetric.findFirst({
      where: {
        athleteProfileId: profile.id,
        date: { gte: today, lt: tomorrow },
        source: "MANUAL",
      },
    }),

    // Active plan
    prisma.workoutPlan.findFirst({
      where: { athleteProfileId: profile.id, isActive: true },
      orderBy: { createdAt: "desc" },
    }),

    // This week's sessions
    getWeekSessions(profile.id, 0),

    // This week's adherence
    getCurrentWeekAdherence(userId),

    // Streak data
    getStreakData(profile.id),

    // Recent messages
    prisma.messageLog.findMany({
      where: { userId },
      orderBy: { sentAt: "desc" },
      take: 5,
      select: {
        id: true,
        channel: true,
        category: true,
        content: true,
        sentAt: true,
      },
    }),
  ]);

  return {
    athlete: {
      firstName: profile.firstName,
      lastName: profile.lastName,
      persona: profile.personaType,
      planTier: user.subscription?.planTier ?? null,
    },
    today: {
      workout: todayWorkout,
      readiness: todayReadiness,
      hasCheckedIn: todayReadiness != null,
    },
    thisWeek: {
      plan: activePlan,
      sessions: weekSessions,
      adherenceRate: weekAdherence.adherenceRate,
      completedCount: weekAdherence.completedCount,
      scheduledCount: weekAdherence.scheduledCount,
    },
    streak: streakData,
    recentMessages,
  };
}

// ============================================================
// getWeekView — sessions for a specific week offset
// ============================================================

export async function getWeekView(
  userId: string,
  weekOffset: number
): Promise<unknown> {
  const profile = await prisma.athleteProfile.findUnique({
    where: { userId },
  });

  if (!profile) {
    const err = new Error("Athlete profile not found") as Error & { statusCode?: number };
    err.statusCode = 404;
    throw err;
  }

  const sessions = await getWeekSessions(profile.id, weekOffset);

  const weekStart = getWeekStart(new Date());
  weekStart.setDate(weekStart.getDate() + weekOffset * 7);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  // Find plan covering this week
  const plan = await prisma.workoutPlan.findFirst({
    where: {
      athleteProfileId: profile.id,
      startDate: { lte: weekEnd },
      endDate: { gte: weekStart },
    },
    orderBy: { createdAt: "desc" },
  });

  const scheduledCount = sessions.length;
  const completedCount = sessions.filter((s) => (s as { status: string }).status === "COMPLETED").length;
  const adherenceRate = scheduledCount > 0 ? completedCount / scheduledCount : 0;

  return { plan, sessions, adherenceRate };
}

// ============================================================
// getWorkoutDetail — full session with content
// ============================================================

export async function getWorkoutDetail(
  userId: string,
  sessionId: string
): Promise<unknown> {
  const profile = await prisma.athleteProfile.findUnique({
    where: { userId },
  });

  if (!profile) {
    const err = new Error("Athlete profile not found") as Error & { statusCode?: number };
    err.statusCode = 404;
    throw err;
  }

  const session = await prisma.workoutSession.findFirst({
    where: {
      id: sessionId,
      workoutPlan: { athleteProfileId: profile.id },
    },
    include: {
      workoutPlan: {
        select: { name: true, weekNumber: true, blockType: true },
      },
    },
  });

  if (!session) {
    const err = new Error("Workout session not found") as Error & { statusCode?: number };
    err.statusCode = 404;
    throw err;
  }

  return session;
}

// ============================================================
// getWorkoutHistory — paginated past sessions
// ============================================================

export async function getWorkoutHistory(
  userId: string,
  page: number,
  limit: number
): Promise<{ sessions: unknown[]; total: number; page: number; totalPages: number }> {
  const profile = await prisma.athleteProfile.findUnique({
    where: { userId },
  });

  if (!profile) {
    return { sessions: [], total: 0, page, totalPages: 0 };
  }

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const [sessions, total] = await Promise.all([
    prisma.workoutSession.findMany({
      where: {
        workoutPlan: { athleteProfileId: profile.id },
        scheduledDate: { lte: today },
      },
      orderBy: { scheduledDate: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        scheduledDate: true,
        sessionType: true,
        title: true,
        status: true,
        completedAt: true,
        actualDuration: true,
        rpe: true,
        athleteNotes: true,
        workoutPlan: { select: { name: true, weekNumber: true } },
      },
    }),
    prisma.workoutSession.count({
      where: {
        workoutPlan: { athleteProfileId: profile.id },
        scheduledDate: { lte: today },
      },
    }),
  ]);

  return {
    sessions,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

// ============================================================
// Helpers
// ============================================================

async function getWeekSessions(profileId: string, weekOffset: number): Promise<unknown[]> {
  const weekStart = getWeekStart(new Date());
  weekStart.setDate(weekStart.getDate() + weekOffset * 7);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  return prisma.workoutSession.findMany({
    where: {
      workoutPlan: { athleteProfileId: profileId },
      scheduledDate: { gte: weekStart, lt: weekEnd },
    },
    orderBy: [{ scheduledDate: "asc" }, { scheduledOrder: "asc" }],
    select: {
      id: true,
      scheduledDate: true,
      scheduledOrder: true,
      sessionType: true,
      title: true,
      description: true,
      prescribedDuration: true,
      status: true,
      completedAt: true,
      actualDuration: true,
      rpe: true,
    },
  });
}

async function getStreakData(profileId: string): Promise<{
  currentStreak: number;
  longestStreak: number;
  totalCompleted: number;
}> {
  const completedSessions = await prisma.workoutSession.findMany({
    where: {
      workoutPlan: { athleteProfileId: profileId },
      status: "COMPLETED",
    },
    orderBy: { scheduledDate: "desc" },
    select: { scheduledDate: true },
  });

  const totalCompleted = completedSessions.length;

  if (totalCompleted === 0) {
    return { currentStreak: 0, longestStreak: 0, totalCompleted: 0 };
  }

  // Get all sessions to calculate streaks by comparing scheduled vs completed
  const allSessions = await prisma.workoutSession.findMany({
    where: {
      workoutPlan: { athleteProfileId: profileId },
      scheduledDate: { lte: new Date() },
    },
    orderBy: { scheduledDate: "desc" },
    select: { status: true, scheduledDate: true },
  });

  // Calculate current streak (consecutive completed from most recent)
  let currentStreak = 0;
  for (const session of allSessions) {
    if (session.status === "COMPLETED") {
      currentStreak++;
    } else {
      break;
    }
  }

  // Calculate longest streak
  let longestStreak = 0;
  let tempStreak = 0;
  // Walk chronologically (reverse the desc order)
  for (let i = allSessions.length - 1; i >= 0; i--) {
    if (allSessions[i].status === "COMPLETED") {
      tempStreak++;
      longestStreak = Math.max(longestStreak, tempStreak);
    } else {
      tempStreak = 0;
    }
  }

  return { currentStreak, longestStreak, totalCompleted };
}
