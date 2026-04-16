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
      subscription: { select: { planTier: true, status: true, currentPeriodStart: true, currentPeriodEnd: true } },
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
    // Today's workout (only from active plan)
    prisma.workoutSession.findFirst({
      where: {
        workoutPlan: { athleteProfileId: profile.id, isActive: true },
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
    athlete: (() => {
      const sub = user.subscription;
      let dayNumber: number | null = null;
      let totalDays: number | null = null;
      if (sub?.currentPeriodStart && sub?.currentPeriodEnd) {
        totalDays = Math.ceil((new Date(sub.currentPeriodEnd).getTime() - new Date(sub.currentPeriodStart).getTime()) / (24 * 60 * 60 * 1000));
        dayNumber = Math.min(totalDays, Math.max(1, Math.ceil((today.getTime() - new Date(sub.currentPeriodStart).getTime()) / (24 * 60 * 60 * 1000)) + 1));
      }
      // Compute plan state
      let planState: "active" | "expired" | "completed" | "renewal_pending" | "pending_approval" | null = null;
      if (sub) {
        if (sub.status === "PENDING_APPROVAL") {
          planState = "pending_approval";
        } else if (sub.currentPeriodEnd && new Date(sub.currentPeriodEnd) < today) {
          // Period ended
          const isRecurring = sub.planTier === "PRIVATE_COACHING";
          planState = isRecurring ? "renewal_pending" : "completed";
        } else if (sub.status === "ACTIVE") {
          planState = "active";
        } else {
          planState = "expired";
        }
      }

      return {
        firstName: profile.firstName,
        lastName: profile.lastName,
        persona: profile.personaType,
        planTier: sub?.planTier ?? null,
        subscriptionStatus: sub?.status ?? null,
        planState,
        dayNumber,
        totalDays,
      };
    })(),
    today: {
      workout: todayWorkout,
      readiness: todayReadiness,
      hasCheckedIn: todayReadiness != null,
    },
    thisWeek: await getWeekView(userId, 0),
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

  // Find the most recent plan covering this week to avoid duplicates from old regenerated plans
  const plan = await prisma.workoutPlan.findFirst({
    where: {
      athleteProfileId: profileId,
      startDate: { lte: weekEnd },
      endDate: { gte: weekStart },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  if (!plan) return [];

  return prisma.workoutSession.findMany({
    where: {
      workoutPlanId: plan.id,
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

// ============================================================
// getDailySummary — 14-day graded daily performance data
// ============================================================

interface DaySummary {
  date: string;
  dayType: "workout" | "missed" | "skipped" | "rest" | "no_data" | "future";
  score: number | null;
  grade: "green" | "yellow" | "red" | "gray";
  readiness: {
    perceivedEnergy: number;
    perceivedSoreness: number;
    perceivedMood: number;
    sleepQualityManual: number;
    readinessAvg: number;
    hrvMs: number | null;
    restingHr: number | null;
    sleepScore: number | null;
    sleepDurationMin: number | null;
    steps: number | null;
  } | null;
  workout: {
    id: string;
    title: string;
    sessionType: string;
    status: string;
    prescribedDuration: number | null;
    actualDuration: number | null;
    prescribedTSS: number | null;
    actualTSS: number | null;
    rpe: number | null;
    athleteNotes: string | null;
    completedAt: string | null;
    planName: string;
    blockType: string;
  } | null;
  breakdown: {
    durationAdherence: number | null;
    tssAdherence: number | null;
    rpeAppropriateness: number | null;
    readinessQuality: number | null;
  } | null;
  hasWearableData: boolean;
  isDeloadWeek: boolean;
}

export async function getDailySummary(
  userId: string,
  days: number
): Promise<{
  days: DaySummary[];
  connectedDevices: string[];
  averageScore: number | null;
}> {
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
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - (days - 1));

  // Parallel fetch: readiness, workouts, devices
  const [readinessRecords, workoutSessions, deviceConnections] = await Promise.all([
    prisma.readinessMetric.findMany({
      where: {
        athleteProfileId: profile.id,
        date: { gte: startDate, lt: tomorrow },
      },
      orderBy: { date: "asc" },
    }),
    prisma.workoutSession.findMany({
      where: {
        workoutPlan: { athleteProfileId: profile.id },
        scheduledDate: { gte: startDate, lt: tomorrow },
      },
      include: {
        workoutPlan: { select: { id: true, name: true, blockType: true, createdAt: true } },
      },
      orderBy: { scheduledDate: "asc" },
    }),
    prisma.deviceConnection.findMany({
      where: { userId, isActive: true },
      select: { provider: true },
    }),
  ]);

  // Index by date string
  const readinessByDate = new Map<string, typeof readinessRecords[number]>();
  for (const r of readinessRecords) {
    const dateStr = r.date.toISOString().split("T")[0];
    // Prefer MANUAL source if multiple exist
    if (!readinessByDate.has(dateStr) || r.source === "MANUAL") {
      readinessByDate.set(dateStr, r);
    }
  }

  const workoutsByDate = new Map<string, typeof workoutSessions[number]>();
  for (const w of workoutSessions) {
    const dateStr = new Date(w.scheduledDate).toISOString().split("T")[0];
    const existing = workoutsByDate.get(dateStr);
    // Keep session from the most recently created plan (avoids duplicates from regenerated plans)
    if (!existing || w.workoutPlan.createdAt > existing.workoutPlan.createdAt) {
      workoutsByDate.set(dateStr, w);
    }
  }

  // Build day summaries
  const daySummaries: DaySummary[] = [];
  let scoreSum = 0;
  let scoreCount = 0;

  for (let i = 0; i < days; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().split("T")[0];
    const isFuture = d.getTime() > today.getTime();

    const readiness = readinessByDate.get(dateStr) ?? null;
    const workout = workoutsByDate.get(dateStr) ?? null;

    if (isFuture) {
      daySummaries.push({
        date: dateStr,
        dayType: "future",
        score: null,
        grade: "gray",
        readiness: null,
        workout: null,
        breakdown: null,
        hasWearableData: false,
        isDeloadWeek: false,
      });
      continue;
    }

    // Build readiness object
    const readinessData = readiness ? {
      perceivedEnergy: readiness.perceivedEnergy ?? 5,
      perceivedSoreness: readiness.perceivedSoreness ?? 5,
      perceivedMood: readiness.perceivedMood ?? 5,
      sleepQualityManual: readiness.sleepQualityManual ?? 5,
      readinessAvg: computeReadinessAvg(
        readiness.perceivedEnergy ?? 5,
        readiness.perceivedSoreness ?? 5,
        readiness.sleepQualityManual ?? 5
      ),
      hrvMs: readiness.hrvMs,
      restingHr: readiness.restingHr,
      sleepScore: readiness.sleepScore,
      sleepDurationMin: readiness.sleepDurationMin,
      steps: readiness.steps,
    } : null;

    const hasWearableData = readiness != null && (
      readiness.hrvMs != null || readiness.restingHr != null ||
      readiness.sleepScore != null || readiness.steps != null
    );

    const blockType = workout?.workoutPlan?.blockType ?? "base";
    const isDeloadWeek = blockType === "deload" || blockType === "recovery";

    // Build workout object
    const workoutData = workout ? {
      id: workout.id,
      title: workout.title,
      sessionType: workout.sessionType,
      status: workout.status,
      prescribedDuration: workout.prescribedDuration,
      actualDuration: workout.actualDuration,
      prescribedTSS: workout.prescribedTSS,
      actualTSS: workout.actualTSS,
      rpe: workout.rpe,
      athleteNotes: workout.athleteNotes,
      completedAt: workout.completedAt?.toISOString() ?? null,
      planName: workout.workoutPlan?.name ?? "",
      blockType,
    } : null;

    // Compute grade
    const { score, dayType, breakdown } = computeDayGrade(
      workout?.status ?? null,
      workoutData,
      readinessData,
      isDeloadWeek
    );

    const grade: "green" | "yellow" | "red" | "gray" =
      score == null ? "gray"
      : score >= 75 ? "green"
      : score >= 50 ? "yellow"
      : "red";

    if (score != null) {
      scoreSum += score;
      scoreCount++;
    }

    daySummaries.push({
      date: dateStr,
      dayType,
      score,
      grade,
      readiness: readinessData,
      workout: workoutData,
      breakdown,
      hasWearableData,
      isDeloadWeek,
    });
  }

  return {
    days: daySummaries,
    connectedDevices: deviceConnections.map((d) => d.provider),
    averageScore: scoreCount > 0 ? Math.round(scoreSum / scoreCount) : null,
  };
}

// ============================================================
// Grading Sub-Functions
// ============================================================

function computeReadinessAvg(
  energy: number,
  soreness: number,
  sleep: number
): number {
  return Math.round(((energy + sleep + (10 - soreness)) / 3) * 10) / 10;
}

function computeReadinessQuality(
  energy: number,
  soreness: number,
  mood: number,
  sleep: number
): number {
  return (energy * 30 + (10 - soreness) * 25 + mood * 20 + sleep * 25) / 10;
}

function computeAdherenceScore(actual: number, prescribed: number): number {
  if (prescribed <= 0) return 100;
  const ratio = actual / prescribed;
  if (ratio >= 0.85 && ratio <= 1.15) return 100;
  if (ratio < 0.85) return Math.max(0, 100 - (0.85 - ratio) * 200);
  // Over by a bit — slight penalty
  return Math.max(50, 100 - (ratio - 1.15) * 100);
}

function computeRpeScore(
  rpe: number,
  readinessAvg: number,
  isDeload: boolean
): number {
  // Determine expected RPE range based on readiness
  let expectedLow: number;
  let expectedHigh: number;

  if (isDeload) {
    expectedLow = 2;
    expectedHigh = 5;
  } else if (readinessAvg >= 7) {
    expectedLow = 6;
    expectedHigh = 9;
  } else if (readinessAvg >= 4) {
    expectedLow = 4;
    expectedHigh = 7;
  } else {
    expectedLow = 3;
    expectedHigh = 5;
  }

  if (rpe >= expectedLow && rpe <= expectedHigh) return 100;
  if (rpe === expectedLow - 1 || rpe === expectedHigh + 1) return 75;

  // Low readiness but pushed too hard
  if (readinessAvg < 4 && rpe > 7) return 30;
  // High readiness but coasted
  if (readinessAvg >= 7 && rpe < 4) return 60;

  return 50;
}

function computeDayGrade(
  status: string | null,
  workout: DaySummary["workout"],
  readiness: DaySummary["readiness"],
  isDeload: boolean
): {
  score: number | null;
  dayType: DaySummary["dayType"];
  breakdown: DaySummary["breakdown"];
} {
  // No workout scheduled
  if (!workout) {
    if (!readiness) {
      return { score: null, dayType: "no_data", breakdown: null };
    }
    // Rest day with readiness data
    const readinessQuality = computeReadinessQuality(
      readiness.perceivedEnergy,
      readiness.perceivedSoreness,
      readiness.perceivedMood,
      readiness.sleepQualityManual
    );
    return {
      score: Math.round(readinessQuality),
      dayType: "rest",
      breakdown: {
        durationAdherence: null,
        tssAdherence: null,
        rpeAppropriateness: null,
        readinessQuality: Math.round(readinessQuality),
      },
    };
  }

  const readinessAvg = readiness?.readinessAvg ?? 5;

  // SKIPPED
  if (status === "SKIPPED") {
    let score: number;
    if (readiness && readinessAvg < 4) score = 65;
    else if (readiness && readinessAvg < 6) score = 50;
    else score = 35;

    return {
      score,
      dayType: "skipped",
      breakdown: {
        durationAdherence: null,
        tssAdherence: null,
        rpeAppropriateness: null,
        readinessQuality: readiness
          ? Math.round(computeReadinessQuality(
              readiness.perceivedEnergy,
              readiness.perceivedSoreness,
              readiness.perceivedMood,
              readiness.sleepQualityManual
            ))
          : null,
      },
    };
  }

  // MISSED
  if (status === "MISSED") {
    let score: number;
    if (readiness && readinessAvg < 4) score = 55;
    else if (readiness) score = 25;
    else score = 20;

    return {
      score,
      dayType: "missed",
      breakdown: {
        durationAdherence: null,
        tssAdherence: null,
        rpeAppropriateness: null,
        readinessQuality: readiness
          ? Math.round(computeReadinessQuality(
              readiness.perceivedEnergy,
              readiness.perceivedSoreness,
              readiness.perceivedMood,
              readiness.sleepQualityManual
            ))
          : null,
      },
    };
  }

  // SCHEDULED (not yet completed — today's workout)
  if (status === "SCHEDULED" || status === "RESCHEDULED") {
    if (!readiness) {
      return { score: null, dayType: "workout", breakdown: null };
    }
    const readinessQuality = computeReadinessQuality(
      readiness.perceivedEnergy,
      readiness.perceivedSoreness,
      readiness.perceivedMood,
      readiness.sleepQualityManual
    );
    return {
      score: Math.round(readinessQuality),
      dayType: "workout",
      breakdown: {
        durationAdherence: null,
        tssAdherence: null,
        rpeAppropriateness: null,
        readinessQuality: Math.round(readinessQuality),
      },
    };
  }

  // COMPLETED — full grading
  const weights: { key: string; weight: number; score: number }[] = [];

  // Duration adherence
  if (workout.prescribedDuration && workout.actualDuration) {
    weights.push({
      key: "duration",
      weight: 25,
      score: computeAdherenceScore(workout.actualDuration, workout.prescribedDuration),
    });
  }

  // TSS adherence
  if (workout.prescribedTSS && workout.actualTSS) {
    weights.push({
      key: "tss",
      weight: 20,
      score: computeAdherenceScore(workout.actualTSS, workout.prescribedTSS),
    });
  }

  // RPE appropriateness
  if (workout.rpe != null) {
    weights.push({
      key: "rpe",
      weight: 20,
      score: computeRpeScore(workout.rpe, readinessAvg, isDeload),
    });
  }

  // Readiness quality
  if (readiness) {
    weights.push({
      key: "readiness",
      weight: 35,
      score: computeReadinessQuality(
        readiness.perceivedEnergy,
        readiness.perceivedSoreness,
        readiness.perceivedMood,
        readiness.sleepQualityManual
      ),
    });
  }

  // Compute weighted average with redistribution
  const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0);

  let finalScore: number;
  if (totalWeight === 0) {
    finalScore = 70; // Default for completed with no other data
  } else {
    finalScore = weights.reduce((sum, w) => sum + w.score * (w.weight / totalWeight), 0);
  }

  // Find individual scores
  const durationEntry = weights.find((w) => w.key === "duration");
  const tssEntry = weights.find((w) => w.key === "tss");
  const rpeEntry = weights.find((w) => w.key === "rpe");
  const readinessEntry = weights.find((w) => w.key === "readiness");

  return {
    score: Math.round(Math.min(100, Math.max(0, finalScore))),
    dayType: "workout",
    breakdown: {
      durationAdherence: durationEntry ? Math.round(durationEntry.score) : null,
      tssAdherence: tssEntry ? Math.round(tssEntry.score) : null,
      rpeAppropriateness: rpeEntry ? Math.round(rpeEntry.score) : null,
      readinessQuality: readinessEntry ? Math.round(readinessEntry.score) : null,
    },
  };
}
