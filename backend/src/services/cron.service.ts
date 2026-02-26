import type { MessageChannel, MessageCategory } from "@prisma/client";
import cron from "node-cron";
import { prisma } from "../lib/prisma.js";
import { logger } from "../lib/logger.js";
import { env } from "../config/env.js";
import { sendEmail } from "../lib/resend.js";
import * as messagingService from "./messaging.service.js";
import * as adherenceService from "./adherence.service.js";
import * as workoutService from "./workout.service.js";
import * as readinessService from "./readiness.service.js";

/**
 * Cron Service — daily data review loop for all active clients.
 * Runs hourly, checks which clients need their daily review based on timezone.
 * All operations are IDEMPOTENT: safe to re-run without double-sends or double-adjustments.
 */

// ============================================================
// In-memory dedup: prevent double-processing within server instance
// Cleared daily at 4am UTC
// ============================================================

const processedReviews = new Map<string, boolean>();

// ============================================================
// Timezone helper
// ============================================================

interface LocalTime {
  hour: number;
  minute: number;
  dayOfWeek: number;
  dateStr: string;
}

function getLocalTime(utcDate: Date, timezone: string): LocalTime {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hourCycle: "h23",
      hour: "numeric",
      minute: "numeric",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "short",
    });

    const parts = formatter.formatToParts(utcDate);
    const hour = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
    const minute = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);
    const year = parts.find((p) => p.type === "year")?.value ?? "2026";
    const month = parts.find((p) => p.type === "month")?.value ?? "01";
    const day = parts.find((p) => p.type === "day")?.value ?? "01";
    const weekday = parts.find((p) => p.type === "weekday")?.value ?? "Mon";

    const dayMap: Record<string, number> = {
      Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
    };

    return {
      hour,
      minute,
      dayOfWeek: dayMap[weekday] ?? 1,
      dateStr: `${year}-${month}-${day}`,
    };
  } catch {
    // Invalid timezone — fall back to UTC
    logger.warn({ timezone }, "Invalid timezone, falling back to UTC");
    return {
      hour: utcDate.getUTCHours(),
      minute: utcDate.getUTCMinutes(),
      dayOfWeek: utcDate.getUTCDay(),
      dateStr: utcDate.toISOString().split("T")[0],
    };
  }
}

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
// startCrons — register all cron jobs on server boot
// ============================================================

export function startCrons(): void {
  logger.info("Registering cron jobs...");

  // Hourly — daily reviews and weekly digest checks
  cron.schedule("0 * * * *", async () => {
    logger.info("Hourly cron tick...");
    try {
      await dailyReviewCron();
    } catch (err) {
      logger.error({ err }, "Daily review cron failed");
    }
    try {
      await weeklyDigestCron();
    } catch (err) {
      logger.error({ err }, "Weekly digest cron failed");
    }
  });

  // Clear stale dedup entries daily at 4am UTC
  cron.schedule("0 4 * * *", () => {
    processedReviews.clear();
    logger.info("Cleared processed reviews cache");
  });

  logger.info("Cron jobs registered successfully");
}

// ============================================================
// dailyReviewCron — timezone-aware client iteration
// ============================================================

async function dailyReviewCron(): Promise<void> {
  const activeClients = await prisma.subscription.findMany({
    where: { status: "ACTIVE" },
    select: {
      userId: true,
      user: {
        select: {
          athleteProfile: {
            select: { timezone: true },
          },
        },
      },
    },
  });

  const now = new Date();
  let processed = 0;
  let skipped = 0;

  for (const client of activeClients) {
    const timezone = client.user.athleteProfile?.timezone ?? "America/New_York";
    const local = getLocalTime(now, timezone);

    // Midnight window: local hour is 0
    // Morning window: local hour is 6 (or hour 5 + minute >= 30 for half-hour-offset timezones)
    const isMidnight = local.hour === 0;
    const isMorning = local.hour === 6 || (local.hour === 5 && local.minute >= 30);

    if (!isMidnight && !isMorning) continue;

    const reviewType = isMidnight ? "midnight" : "morning";
    const dedupKey = `${client.userId}:${local.dateStr}:${reviewType}`;

    if (processedReviews.has(dedupKey)) {
      skipped++;
      continue;
    }

    const start = Date.now();
    try {
      await dailyReviewForClient(client.userId, isMorning);
      processedReviews.set(dedupKey, true);
      processed++;
      logger.info(
        { userId: client.userId, reviewType, durationMs: Date.now() - start },
        "Daily review completed for client"
      );
    } catch (err) {
      logger.error(
        { err, userId: client.userId, reviewType },
        "Daily review failed for client — continuing to next"
      );
    }
  }

  if (processed > 0 || skipped > 0) {
    logger.info(
      { processed, skipped, totalClients: activeClients.length },
      "Daily review cron completed"
    );
  }
}

// ============================================================
// dailyReviewForClient — THE CORE LOOP (6 steps, idempotent)
// ============================================================

export async function dailyReviewForClient(
  userId: string,
  isMorningReview: boolean = false
): Promise<void> {
  const startTime = Date.now();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      athleteProfile: true,
      subscription: { select: { planTier: true, status: true } },
    },
  });

  if (!user?.athleteProfile) {
    logger.warn({ userId }, "Daily review skipped: no athlete profile");
    return;
  }

  const profile = user.athleteProfile;

  // Client's local time for timezone-aware checks
  const localTime = getLocalTime(new Date(), profile.timezone);

  // UTC dates for today and yesterday
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  // Get active plan with sessions
  const activePlan = await prisma.workoutPlan.findFirst({
    where: { athleteProfileId: profile.id, isActive: true },
    orderBy: { weekNumber: "desc" },
    include: { sessions: { orderBy: { scheduledDate: "asc" } } },
  });

  // ── Step 1: CHECK YESTERDAY'S WORKOUT STATUS ─────────────

  const yesterdaySessions = activePlan?.sessions.filter((s) => {
    const sDate = new Date(s.scheduledDate);
    sDate.setUTCHours(0, 0, 0, 0);
    return sDate.getTime() === yesterday.getTime();
  }) ?? [];

  // Sessions still SCHEDULED from yesterday → should be marked MISSED
  const missedSessions = yesterdaySessions.filter((s) => s.status === "SCHEDULED");
  const completedSessions = yesterdaySessions.filter((s) => s.status === "COMPLETED");

  for (const session of missedSessions) {
    try {
      const isStrength = session.sessionType.startsWith("STRENGTH");
      const isEndurance = session.sessionType.startsWith("ENDURANCE");

      if (isStrength && activePlan) {
        // Marks session MISSED + reschedules + creates AdjustmentLog
        await workoutService.adjustForMissedStrengthDay(activePlan.id, session.id);
      } else if (isEndurance && activePlan) {
        // Marks session MISSED + adjusts + creates AdjustmentLog
        await workoutService.adjustForMissedEnduranceDay(activePlan.id, session.id);
      } else {
        // HIIT, MOBILITY, etc. — just mark as missed
        await prisma.workoutSession.update({
          where: { id: session.id },
          data: { status: "MISSED" },
        });
      }
    } catch (err) {
      // Ensure session is at minimum marked MISSED even if adjustment fails
      await prisma.workoutSession
        .update({ where: { id: session.id }, data: { status: "MISSED" } })
        .catch(() => {});
      logger.error({ err, userId, sessionId: session.id }, "Workout adjustment failed");
    }

    // Update adherence for yesterday's week
    await adherenceService.updateAdherence(userId, yesterday);
  }

  // Send WORKOUT_MISSED message if sessions were missed (dedup: once per day)
  if (missedSessions.length > 0) {
    const existingMissedMsg = await prisma.messageLog.findFirst({
      where: { userId, category: "WORKOUT_MISSED", sentAt: { gte: today } },
    });
    if (!existingMissedMsg) {
      try {
        await messagingService.sendMessage(userId, "WORKOUT_MISSED", "SMS", {
          firstName: profile.firstName,
        });
      } catch (err) {
        logger.error({ err, userId }, "Failed to send WORKOUT_MISSED message");
      }
    }
  }

  // Send WORKOUT_COMPLETED message if sessions were completed yesterday (dedup)
  if (completedSessions.length > 0) {
    const existingCompletedMsg = await prisma.messageLog.findFirst({
      where: { userId, category: "WORKOUT_COMPLETED", sentAt: { gte: yesterday } },
    });
    if (!existingCompletedMsg) {
      try {
        await messagingService.sendMessage(userId, "WORKOUT_COMPLETED", "SMS", {
          firstName: profile.firstName,
          workoutTitle: completedSessions[0].title,
        });
      } catch (err) {
        logger.error({ err, userId }, "Failed to send WORKOUT_COMPLETED message");
      }
    }

    // Update adherence for completed sessions
    await adherenceService.updateAdherence(userId, yesterday);
  }

  // ── Step 2: CHECK READINESS DATA ───────────────────────────

  const todayReadiness = await prisma.readinessMetric.findFirst({
    where: {
      athleteProfileId: profile.id,
      date: today,
      source: "MANUAL",
    },
  });

  if (todayReadiness && activePlan) {
    // Evaluate flags (matches readiness.service.ts logic)
    const highFatigue =
      (todayReadiness.perceivedEnergy ?? 5) < 4 &&
      (todayReadiness.perceivedSoreness ?? 5) > 7;
    const lowSleep = (todayReadiness.sleepQualityManual ?? 5) < 4;
    const lowHrv = todayReadiness.hrvMs != null && todayReadiness.hrvMs < 30;

    // Check if adjustments already made today (idempotent)
    const todayAdjustments = await prisma.adjustmentLog.findMany({
      where: {
        workoutPlanId: activePlan.id,
        createdAt: { gte: today },
      },
      select: { triggerEvent: true },
    });
    const triggeredToday = new Set(todayAdjustments.map((a) => a.triggerEvent));

    if (highFatigue && !triggeredToday.has("high_fatigue")) {
      try {
        await workoutService.adjustForHighFatigue(activePlan.id, {
          perceivedEnergy: todayReadiness.perceivedEnergy,
          perceivedSoreness: todayReadiness.perceivedSoreness,
          fatigueScore: todayReadiness.fatigueScore,
        });
      } catch (err) {
        logger.error({ err, userId }, "adjustForHighFatigue failed");
      }
    }

    if (lowSleep && !triggeredToday.has("low_sleep")) {
      try {
        await workoutService.adjustForLowSleep(activePlan.id, {
          sleepQualityManual: todayReadiness.sleepQualityManual,
          sleepDurationMin: todayReadiness.sleepDurationMin,
          sleepScore: todayReadiness.sleepScore,
        });
      } catch (err) {
        logger.error({ err, userId }, "adjustForLowSleep failed");
      }
    }

    // Send RECOVERY_TIP if any recovery flag is active (dedup)
    if (highFatigue || lowSleep || lowHrv) {
      const existingRecoveryMsg = await prisma.messageLog.findFirst({
        where: { userId, category: "RECOVERY_TIP", sentAt: { gte: today } },
      });
      if (!existingRecoveryMsg) {
        try {
          await messagingService.sendMessage(userId, "RECOVERY_TIP", "SMS", {
            firstName: profile.firstName,
          });
        } catch (err) {
          logger.error({ err, userId }, "Failed to send RECOVERY_TIP message");
        }
      }
    }
  } else if (!todayReadiness && isMorningReview) {
    // No check-in yet and it's the morning review → prompt check-in (dedup)
    const existingCheckInMsg = await prisma.messageLog.findFirst({
      where: { userId, category: "CHECK_IN", sentAt: { gte: today } },
    });
    if (!existingCheckInMsg) {
      try {
        await messagingService.sendMessage(userId, "CHECK_IN", "SMS", {
          firstName: profile.firstName,
          checkInLink: `${env.FRONTEND_URL}/dashboard/checkin`,
        });
      } catch (err) {
        logger.error({ err, userId }, "Failed to send CHECK_IN message");
      }
    }
  }

  // ── Step 3: CHECK ADHERENCE ESCALATION ──────────────────────

  const consecutiveMissed = await adherenceService.getConsecutiveMissed(userId);
  const weekAdherence = await adherenceService.getCurrentWeekAdherence(userId);

  // Escalation triggers: 3+ consecutive missed OR weekly adherence < 50%
  if (consecutiveMissed >= 3 || weekAdherence.adherenceRate < 0.5) {
    // Check if escalation already created today (idempotent)
    const todayEscalation = await prisma.escalationEvent.findFirst({
      where: { userId, createdAt: { gte: today } },
    });

    if (!todayEscalation) {
      // Determine level from recent escalation history (last 30 days)
      const thirtyDaysAgo = new Date(today);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const recentEscalations = await prisma.escalationEvent.findMany({
        where: { userId, createdAt: { gte: thirtyDaysAgo } },
        orderBy: { createdAt: "desc" },
      });

      const unresolvedCount = recentEscalations.filter((e) => !e.resolvedAt).length;

      let level: number;
      if (unresolvedCount >= 2) {
        level = 3; // "Let's talk" with calendar link
      } else if (unresolvedCount === 1) {
        level = 2; // Direct concern
      } else {
        level = 1; // Gentle nudge
      }

      const triggerReason = consecutiveMissed >= 3
        ? "3_missed_workouts"
        : "low_weekly_adherence";

      const escalation = await prisma.escalationEvent.create({
        data: {
          userId,
          triggerReason,
          escalationLevel: level,
        },
      });

      // Send ESCALATION message — email for level 3, SMS for levels 1-2
      try {
        const channel: "SMS" | "EMAIL" = level >= 3 ? "EMAIL" : "SMS";
        const result = await messagingService.sendMessage(userId, "ESCALATION", channel, {
          firstName: profile.firstName,
          bookingLink: `${env.FRONTEND_URL}/book-consultation`,
        });

        await prisma.escalationEvent.update({
          where: { id: escalation.id },
          data: { messageSent: true, messageLogId: result.messageId },
        });
      } catch (err) {
        logger.error({ err, userId, level }, "Failed to send ESCALATION message");
      }
    }
  } else if (consecutiveMissed === 2) {
    // 2 consecutive missed → send concern-level WORKOUT_MISSED (dedup)
    const existingConcernMsg = await prisma.messageLog.findFirst({
      where: { userId, category: "WORKOUT_MISSED", sentAt: { gte: today } },
    });
    if (!existingConcernMsg) {
      try {
        await messagingService.sendMessage(userId, "WORKOUT_MISSED", "SMS", {
          firstName: profile.firstName,
        });
      } catch (err) {
        logger.error({ err, userId }, "Failed to send concern WORKOUT_MISSED message");
      }
    }
  }

  // ── Step 4: WEEKLY PLAN GENERATION (Sunday midnight) ────────

  const isEndOfPlan = activePlan
    ? (() => {
        const endDate = new Date(activePlan.endDate);
        endDate.setUTCHours(0, 0, 0, 0);
        return endDate.getTime() <= today.getTime();
      })()
    : false;

  // Use local day of week for timezone-correct Sunday check
  if (localTime.dayOfWeek === 0 || isEndOfPlan) {
    // Check if next week's plan already exists (idempotent)
    const nextMonday = getWeekStart(new Date());
    nextMonday.setDate(nextMonday.getDate() + 7);

    const existingNextPlan = await prisma.workoutPlan.findFirst({
      where: {
        athleteProfileId: profile.id,
        startDate: { gte: nextMonday },
      },
    });

    if (!existingNextPlan) {
      try {
        await workoutService.generateNextWeek(profile.id);

        // Send plan-ready message (dedup)
        const existingPlanMsg = await prisma.messageLog.findFirst({
          where: { userId, category: "SYSTEM", sentAt: { gte: today } },
        });
        if (!existingPlanMsg) {
          await messagingService.sendMessage(userId, "SYSTEM", "SMS", {
            firstName: profile.firstName,
          });
        }
      } catch (err) {
        logger.error({ err, userId }, "Failed to generate next week plan");
      }
    }
  }

  // ── Step 5: DAILY MOTIVATION ────────────────────────────────

  const planTier = user.subscription?.planTier;
  if (planTier) {
    // 70% chance (prevents message fatigue)
    if (Math.random() < 0.7) {
      // Skip if too many messages already sent today
      const todayMessageCount = await prisma.messageLog.count({
        where: { userId, sentAt: { gte: today } },
      });

      if (todayMessageCount <= 1) {
        const existingMotivation = await prisma.messageLog.findFirst({
          where: { userId, category: "MOTIVATION", sentAt: { gte: today } },
        });
        if (!existingMotivation) {
          try {
            await messagingService.sendMessage(userId, "MOTIVATION", "SMS", {
              firstName: profile.firstName,
              adherenceRate: weekAdherence.adherenceRate,
            });
          } catch (err) {
            logger.error({ err, userId }, "Failed to send MOTIVATION message");
          }
        }
      }
    }
  }

  // ── Step 6: LOG ─────────────────────────────────────────────

  const durationMs = Date.now() - startTime;
  logger.info(
    {
      userId,
      profileId: profile.id,
      durationMs,
      yesterdayMissed: missedSessions.length,
      yesterdayCompleted: completedSessions.length,
      hasReadiness: !!todayReadiness,
      consecutiveMissed,
      isMorningReview,
    },
    "Daily review completed"
  );
}

// ============================================================
// weeklyDigestCron — timezone-aware Monday 9am
// ============================================================

async function weeklyDigestCron(): Promise<void> {
  const now = new Date();

  const activeClients = await prisma.subscription.findMany({
    where: { status: "ACTIVE" },
    select: {
      userId: true,
      user: {
        select: {
          email: true,
          athleteProfile: {
            select: { id: true, firstName: true, timezone: true },
          },
        },
      },
    },
  });

  let processed = 0;

  for (const client of activeClients) {
    const timezone = client.user.athleteProfile?.timezone ?? "America/New_York";
    const local = getLocalTime(now, timezone);

    // Only send on Monday (dayOfWeek=1) at 9am local
    if (local.dayOfWeek !== 1 || local.hour !== 9) continue;

    // In-memory dedup
    const dedupKey = `digest:${client.userId}:${local.dateStr}`;
    if (processedReviews.has(dedupKey)) continue;

    // DB dedup: check if digest email already sent this week
    const weekStart = getWeekStart(now);
    const existingDigest = await prisma.messageLog.findFirst({
      where: {
        userId: client.userId,
        category: "SYSTEM",
        channel: "EMAIL",
        sentAt: { gte: weekStart },
      },
    });
    if (existingDigest) {
      processedReviews.set(dedupKey, true);
      continue;
    }

    try {
      await sendWeeklyDigest(client.userId);
      processedReviews.set(dedupKey, true);
      processed++;
    } catch (err) {
      logger.error({ err, userId: client.userId }, "Weekly digest failed for client");
    }
  }

  if (processed > 0) {
    logger.info({ processed }, "Weekly digest cron completed");
  }
}

// ============================================================
// sendWeeklyDigest — compose and send summary email
// ============================================================

async function sendWeeklyDigest(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      athleteProfile: true,
      subscription: { select: { planTier: true } },
    },
  });

  if (!user?.athleteProfile) return;

  const profile = user.athleteProfile;

  // Last week's Monday-Sunday
  const lastWeekStart = getWeekStart(new Date());
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);
  const lastWeekEnd = new Date(lastWeekStart);
  lastWeekEnd.setDate(lastWeekEnd.getDate() + 7);

  // Parallel data fetch
  const [weekSessions, adherenceRecord, trends, activePlan] = await Promise.all([
    prisma.workoutSession.findMany({
      where: {
        workoutPlan: { athleteProfileId: profile.id },
        scheduledDate: { gte: lastWeekStart, lt: lastWeekEnd },
      },
      select: { status: true, sessionType: true, title: true },
    }),
    prisma.adherenceRecord.findFirst({
      where: { userId, weekStartDate: lastWeekStart },
    }),
    readinessService.getTrends(userId),
    prisma.workoutPlan.findFirst({
      where: { athleteProfileId: profile.id, isActive: true },
      orderBy: { weekNumber: "desc" },
      include: {
        sessions: {
          select: { title: true, scheduledDate: true, sessionType: true },
          orderBy: { scheduledDate: "asc" },
        },
      },
    }),
  ]);

  const completedCount = weekSessions.filter((s) => s.status === "COMPLETED").length;
  const scheduledCount = weekSessions.length;
  const adherenceRate = adherenceRecord?.adherenceRate
    ?? (scheduledCount > 0 ? completedCount / scheduledCount : 0);

  // Build personalized note
  let personalNote: string;
  if (adherenceRate >= 0.9) {
    personalNote = `Outstanding week, ${profile.firstName}. ${completedCount}/${scheduledCount} sessions completed. Your consistency is building real results.`;
  } else if (adherenceRate >= 0.7) {
    personalNote = `Solid week, ${profile.firstName}. ${completedCount}/${scheduledCount} sessions logged. Keep building on this momentum.`;
  } else if (adherenceRate >= 0.5) {
    personalNote = `${profile.firstName}, you got ${completedCount}/${scheduledCount} sessions in. Every rep counts. Let's build from here this week.`;
  } else {
    personalNote = `${profile.firstName}, last week was tough — ${completedCount}/${scheduledCount} sessions. No judgment. This week is a fresh start.`;
  }

  // Readiness trend label
  const trendLabel = trends.trend === "improving"
    ? "Trending Up"
    : trends.trend === "declining"
      ? "Needs Attention"
      : "Holding Steady";

  // Next week plan overview
  let nextWeekOverview = "Your plan for this week is being prepared.";
  if (activePlan && activePlan.sessions.length > 0) {
    const sessionLines = activePlan.sessions.map((s) => {
      const dayName = new Date(s.scheduledDate).toLocaleDateString("en-US", {
        weekday: "short",
        timeZone: "UTC",
      });
      return `${dayName}: ${s.title}`;
    });
    nextWeekOverview = `${activePlan.name}<br>${sessionLines.join("<br>")}`;
  }

  // Compose email content (HTML-formatted for branded template)
  const emailContent = [
    `<strong>Last Week</strong>`,
    `Sessions: ${completedCount}/${scheduledCount} completed`,
    `Adherence: ${Math.round(adherenceRate * 100)}%`,
    `Readiness: ${trendLabel} (Energy ${trends.avgEnergy}/10 · Sleep ${trends.avgSleep}/10)`,
    ``,
    personalNote,
    ``,
    `<strong>This Week</strong>`,
    nextWeekOverview,
    ``,
    `Stay disciplined. Stay dominant.`,
  ].join("<br>");

  // Send via Resend directly (custom content, not template-based)
  const externalId = await sendEmail(
    user.email,
    "Your Weekly Summary — Vintus Performance",
    emailContent
  );

  // Log in MessageLog for dedup and history
  await prisma.messageLog.create({
    data: {
      userId,
      channel: "EMAIL" as MessageChannel,
      category: "SYSTEM" as MessageCategory,
      templateId: "weekly-digest",
      content: emailContent,
      externalId,
      failedAt: externalId ? undefined : new Date(),
      failureReason: externalId ? undefined : "Email delivery failed",
    },
  });

  logger.info(
    { userId, completedCount, scheduledCount, adherenceRate, trend: trends.trend },
    "Weekly digest sent"
  );
}
