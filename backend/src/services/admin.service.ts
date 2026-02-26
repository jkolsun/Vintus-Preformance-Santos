import type { Prisma, MessageChannel, MessageCategory } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { logger } from "../lib/logger.js";
import { env } from "../config/env.js";
import { stripe } from "../config/stripe.js";
import { sendSMS } from "../lib/twilio.js";
import { sendEmail } from "../lib/resend.js";

/**
 * Admin Service — client management, analytics, system health, and workout overrides.
 */

// ============================================================
// Tier prices for MRR calculation
// ============================================================

// Only PRIVATE_COACHING contributes to MRR (recurring).
// One-time purchases are revenue but not monthly recurring.
const TIER_MONTHLY_PRICE: Record<string, number> = {
  PRIVATE_COACHING: 500,
  TRAINING_30DAY: 0,
  TRAINING_60DAY: 0,
  TRAINING_90DAY: 0,
  NUTRITION_4WEEK: 0,
  NUTRITION_8WEEK: 0,
};

// ============================================================
// CLIENT MANAGEMENT
// ============================================================

/**
 * Get paginated list of clients with profile summary, subscription, and adherence.
 */
export async function getClients(options: {
  page: number;
  limit: number;
  search?: string;
  tier?: string;
  status?: string;
}): Promise<{
  clients: unknown[];
  total: number;
  page: number;
  totalPages: number;
}> {
  const { page, limit, search, tier, status } = options;

  // Build filter conditions
  const where: Prisma.UserWhereInput = {
    role: "CLIENT",
  };

  if (search) {
    where.OR = [
      { email: { contains: search, mode: "insensitive" } },
      { athleteProfile: { firstName: { contains: search, mode: "insensitive" } } },
      { athleteProfile: { lastName: { contains: search, mode: "insensitive" } } },
    ];
  }

  if (tier) {
    where.subscription = { planTier: tier as Prisma.EnumPlanTierFilter };
  }

  if (status) {
    where.subscription = {
      ...where.subscription as Prisma.SubscriptionWhereInput,
      status: status as Prisma.EnumSubscriptionStatusFilter,
    };
  }

  const [clients, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        createdAt: true,
        athleteProfile: {
          select: {
            firstName: true,
            lastName: true,
            primaryGoal: true,
            personaType: true,
            experienceLevel: true,
            trainingDaysPerWeek: true,
          },
        },
        subscription: {
          select: {
            planTier: true,
            status: true,
            currentPeriodEnd: true,
          },
        },
      },
    }),
    prisma.user.count({ where }),
  ]);

  // Fetch current week adherence for each client
  const weekStart = getWeekStart(new Date());
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const enriched = await Promise.all(
    clients.map(async (client) => {
      const adherenceRecord = await prisma.adherenceRecord.findFirst({
        where: { userId: client.id, weekStartDate: weekStart },
        select: { adherenceRate: true, completedCount: true, scheduledCount: true },
      });

      return {
        ...client,
        adherence: adherenceRecord
          ? {
              rate: adherenceRecord.adherenceRate,
              completed: adherenceRecord.completedCount,
              scheduled: adherenceRecord.scheduledCount,
            }
          : null,
      };
    })
  );

  return {
    clients: enriched,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Get full client detail — profile, subscription, adherence, recent workouts, messages, escalations.
 */
export async function getClientDetail(userId: string): Promise<unknown> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      athleteProfile: {
        include: {
          workoutPlans: {
            where: { isActive: true },
            orderBy: { weekNumber: "desc" },
            take: 1,
            include: {
              sessions: {
                orderBy: { scheduledDate: "asc" },
                select: {
                  id: true,
                  scheduledDate: true,
                  sessionType: true,
                  title: true,
                  status: true,
                  completedAt: true,
                  actualDuration: true,
                  rpe: true,
                },
              },
              adjustmentLogs: {
                orderBy: { createdAt: "desc" },
                take: 10,
                select: {
                  id: true,
                  triggerEvent: true,
                  adjustmentType: true,
                  description: true,
                  createdAt: true,
                },
              },
            },
          },
        },
      },
      subscription: true,
      messageLogs: {
        orderBy: { sentAt: "desc" },
        take: 20,
        select: {
          id: true,
          channel: true,
          category: true,
          content: true,
          sentAt: true,
          failedAt: true,
          failureReason: true,
        },
      },
      escalationEvents: {
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          triggerReason: true,
          escalationLevel: true,
          messageSent: true,
          callBooked: true,
          resolvedAt: true,
          resolution: true,
          createdAt: true,
        },
      },
    },
  });

  if (!user) {
    const err = new Error("User not found") as Error & { statusCode?: number };
    err.statusCode = 404;
    throw err;
  }

  // Get adherence history (last 8 weeks)
  const eightWeeksAgo = new Date();
  eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56);
  eightWeeksAgo.setUTCHours(0, 0, 0, 0);

  const adherenceHistory = await prisma.adherenceRecord.findMany({
    where: { userId, weekStartDate: { gte: eightWeeksAgo } },
    orderBy: { weekStartDate: "desc" },
  });

  // Get consecutive missed count
  const consecutiveMissed = await getConsecutiveMissedForAdmin(userId);

  return {
    ...user,
    adherenceHistory,
    consecutiveMissed,
  };
}

/**
 * Add/update admin notes on a client's profile.
 */
export async function updateClientNotes(
  userId: string,
  notes: string
): Promise<{ success: boolean }> {
  const profile = await prisma.athleteProfile.findUnique({
    where: { userId },
  });

  if (!profile) {
    const err = new Error("Athlete profile not found") as Error & { statusCode?: number };
    err.statusCode = 404;
    throw err;
  }

  // Store notes in the aiSummary field (admin notes appended) or we can use a JSON approach
  // For MVP, append to existing aiSummary with a separator
  const existingNotes = profile.aiSummary ?? "";
  const separator = existingNotes.includes("[ADMIN NOTES]") ? "" : "\n\n[ADMIN NOTES]\n";
  const adminSection = existingNotes.includes("[ADMIN NOTES]")
    ? existingNotes.substring(0, existingNotes.indexOf("[ADMIN NOTES]")) + "[ADMIN NOTES]\n" + notes
    : existingNotes + separator + notes;

  await prisma.athleteProfile.update({
    where: { userId },
    data: { aiSummary: adminSection },
  });

  logger.info({ userId }, "Admin notes updated");
  return { success: true };
}

/**
 * Send a custom message to a client (bypasses template system).
 */
export async function sendCustomMessage(
  userId: string,
  content: string,
  channel: "SMS" | "EMAIL"
): Promise<{ messageId: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { athleteProfile: true },
  });

  if (!user) {
    const err = new Error("User not found") as Error & { statusCode?: number };
    err.statusCode = 404;
    throw err;
  }

  let externalId: string | null = null;
  let failedAt: Date | undefined;
  let failureReason: string | undefined;

  if (channel === "SMS") {
    const phone = user.athleteProfile?.phone;
    if (phone) {
      externalId = await sendSMS(phone, content);
      if (!externalId) {
        failedAt = new Date();
        failureReason = "SMS delivery failed";
      }
    } else {
      failedAt = new Date();
      failureReason = "No phone number on file";
      logger.warn({ userId }, "Cannot send custom SMS: no phone number on profile");
    }
  } else {
    externalId = await sendEmail(user.email, "Message from Vintus Performance", content);
    if (!externalId) {
      failedAt = new Date();
      failureReason = "Email delivery failed";
    }
  }

  const log = await prisma.messageLog.create({
    data: {
      userId,
      channel: channel as MessageChannel,
      category: "SYSTEM" as MessageCategory,
      templateId: "admin-custom",
      content,
      externalId,
      failedAt,
      failureReason,
    },
  });

  logger.info({ userId, messageId: log.id, channel }, "Custom admin message sent");
  return { messageId: log.id };
}

// ============================================================
// ANALYTICS
// ============================================================

/**
 * Get aggregate business overview metrics.
 */
export async function getAnalyticsOverview(): Promise<{
  totalClients: number;
  activeClients: number;
  byTier: Record<string, number>;
  avgAdherenceRate: number;
  churnedLast30Days: number;
  newLast30Days: number;
  mrr: number;
}> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [
    totalClients,
    activeSubs,
    tierGroups,
    churnedLast30,
    newLast30,
    recentAdherence,
  ] = await Promise.all([
    // Total clients (all users with CLIENT role)
    prisma.user.count({ where: { role: "CLIENT" } }),

    // Active subscriptions
    prisma.subscription.count({ where: { status: "ACTIVE" } }),

    // Group by tier
    prisma.subscription.groupBy({
      by: ["planTier"],
      where: { status: "ACTIVE" },
      _count: { id: true },
    }),

    // Churned in last 30 days
    prisma.subscription.count({
      where: { status: "CANCELED", updatedAt: { gte: thirtyDaysAgo } },
    }),

    // New in last 30 days
    prisma.subscription.count({
      where: { createdAt: { gte: thirtyDaysAgo } },
    }),

    // Average adherence (last 4 weeks)
    prisma.adherenceRecord.aggregate({
      where: {
        weekStartDate: {
          gte: (() => {
            const d = new Date();
            d.setDate(d.getDate() - 28);
            d.setUTCHours(0, 0, 0, 0);
            return d;
          })(),
        },
      },
      _avg: { adherenceRate: true },
    }),
  ]);

  // Build tier map
  const byTier: Record<string, number> = {
    PRIVATE_COACHING: 0,
    TRAINING_30DAY: 0,
    TRAINING_60DAY: 0,
    TRAINING_90DAY: 0,
    NUTRITION_4WEEK: 0,
    NUTRITION_8WEEK: 0,
  };
  for (const group of tierGroups) {
    byTier[group.planTier] = group._count.id;
  }

  // Calculate MRR
  const mrr = Object.entries(byTier).reduce(
    (sum, [tier, count]) => sum + (TIER_MONTHLY_PRICE[tier] ?? 0) * count,
    0
  );

  return {
    totalClients,
    activeClients: activeSubs,
    byTier,
    avgAdherenceRate: Math.round((recentAdherence._avg.adherenceRate ?? 0) * 100) / 100,
    churnedLast30Days: churnedLast30,
    newLast30Days: newLast30,
    mrr,
  };
}

/**
 * Get aggregate adherence trends (weekly averages for the last 12 weeks).
 */
export async function getAdherenceTrends(): Promise<unknown[]> {
  const twelveWeeksAgo = new Date();
  twelveWeeksAgo.setDate(twelveWeeksAgo.getDate() - 84);
  twelveWeeksAgo.setUTCHours(0, 0, 0, 0);

  const records = await prisma.adherenceRecord.findMany({
    where: { weekStartDate: { gte: twelveWeeksAgo } },
    select: {
      weekStartDate: true,
      adherenceRate: true,
      completedCount: true,
      scheduledCount: true,
      missedCount: true,
    },
  });

  // Group by week
  const weekMap = new Map<
    string,
    { rates: number[]; completed: number; scheduled: number; missed: number }
  >();

  for (const record of records) {
    const weekKey = record.weekStartDate.toISOString().split("T")[0];
    const existing = weekMap.get(weekKey) ?? {
      rates: [],
      completed: 0,
      scheduled: 0,
      missed: 0,
    };
    existing.rates.push(record.adherenceRate);
    existing.completed += record.completedCount;
    existing.scheduled += record.scheduledCount;
    existing.missed += record.missedCount;
    weekMap.set(weekKey, existing);
  }

  // Convert to sorted array
  const weeks = Array.from(weekMap.entries())
    .map(([weekStart, data]) => ({
      weekStart,
      avgAdherenceRate:
        data.rates.length > 0
          ? Math.round((data.rates.reduce((a, b) => a + b, 0) / data.rates.length) * 100) / 100
          : 0,
      totalCompleted: data.completed,
      totalScheduled: data.scheduled,
      totalMissed: data.missed,
      clientCount: data.rates.length,
    }))
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart));

  return weeks;
}

/**
 * Get recent escalation events with user info and resolution status.
 */
export async function getEscalationEvents(options: {
  page: number;
  limit: number;
  resolved?: boolean;
}): Promise<{
  escalations: unknown[];
  total: number;
  page: number;
  totalPages: number;
}> {
  const { page, limit, resolved } = options;

  const where: Prisma.EscalationEventWhereInput = {};
  if (resolved === true) {
    where.resolvedAt = { not: null };
  } else if (resolved === false) {
    where.resolvedAt = null;
  }

  const [escalations, total] = await Promise.all([
    prisma.escalationEvent.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            athleteProfile: {
              select: { firstName: true, lastName: true },
            },
          },
        },
      },
    }),
    prisma.escalationEvent.count({ where }),
  ]);

  return {
    escalations,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

// ============================================================
// SYSTEM
// ============================================================

/**
 * Check health of external services: database, Twilio, Resend, Anthropic, Stripe.
 */
export async function getSystemHealth(): Promise<
  Record<string, { status: "ok" | "error"; latencyMs: number; error?: string }>
> {
  const results: Record<
    string,
    { status: "ok" | "error"; latencyMs: number; error?: string }
  > = {};

  // Database check
  const dbStart = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    results.database = { status: "ok", latencyMs: Date.now() - dbStart };
  } catch (err) {
    results.database = {
      status: "error",
      latencyMs: Date.now() - dbStart,
      error: (err as Error).message,
    };
  }

  // Stripe check
  const stripeStart = Date.now();
  try {
    await stripe.balance.retrieve();
    results.stripe = { status: "ok", latencyMs: Date.now() - stripeStart };
  } catch (err) {
    results.stripe = {
      status: "error",
      latencyMs: Date.now() - stripeStart,
      error: (err as Error).message,
    };
  }

  // Twilio check — verify credentials by fetching account info
  const twilioStart = Date.now();
  try {
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}.json`,
      {
        headers: {
          Authorization:
            "Basic " +
            Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString(
              "base64"
            ),
        },
      }
    );
    if (response.ok) {
      results.twilio = { status: "ok", latencyMs: Date.now() - twilioStart };
    } else {
      results.twilio = {
        status: "error",
        latencyMs: Date.now() - twilioStart,
        error: `HTTP ${response.status}`,
      };
    }
  } catch (err) {
    results.twilio = {
      status: "error",
      latencyMs: Date.now() - twilioStart,
      error: (err as Error).message,
    };
  }

  // Resend check — list API keys endpoint as a ping
  const resendStart = Date.now();
  try {
    const response = await fetch("https://api.resend.com/api-keys", {
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}` },
    });
    if (response.ok || response.status === 200) {
      results.resend = { status: "ok", latencyMs: Date.now() - resendStart };
    } else {
      results.resend = {
        status: "error",
        latencyMs: Date.now() - resendStart,
        error: `HTTP ${response.status}`,
      };
    }
  } catch (err) {
    results.resend = {
      status: "error",
      latencyMs: Date.now() - resendStart,
      error: (err as Error).message,
    };
  }

  // Anthropic check — list models as a lightweight ping
  const anthropicStart = Date.now();
  try {
    const response = await fetch("https://api.anthropic.com/v1/models", {
      headers: {
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
    });
    if (response.ok) {
      results.anthropic = { status: "ok", latencyMs: Date.now() - anthropicStart };
    } else {
      results.anthropic = {
        status: "error",
        latencyMs: Date.now() - anthropicStart,
        error: `HTTP ${response.status}`,
      };
    }
  } catch (err) {
    results.anthropic = {
      status: "error",
      latencyMs: Date.now() - anthropicStart,
      error: (err as Error).message,
    };
  }

  return results;
}

/**
 * Get cron job status — last runs, errors from recent logs.
 */
export async function getCronStatus(): Promise<{
  lastDailyReview: Date | null;
  lastWeeklyDigest: Date | null;
  recentErrors: unknown[];
  activeClientCount: number;
}> {
  // Use message logs as proxy for last cron activity
  const [lastDailyMsg, lastDigestMsg, activeCount] = await Promise.all([
    // Last daily review indicator: most recent WORKOUT_MISSED, CHECK_IN, or MOTIVATION message
    prisma.messageLog.findFirst({
      where: {
        category: { in: ["WORKOUT_MISSED", "CHECK_IN", "MOTIVATION", "RECOVERY_TIP"] },
      },
      orderBy: { sentAt: "desc" },
      select: { sentAt: true },
    }),

    // Last weekly digest: SYSTEM category email
    prisma.messageLog.findFirst({
      where: {
        category: "SYSTEM",
        channel: "EMAIL",
        templateId: "weekly-digest",
      },
      orderBy: { sentAt: "desc" },
      select: { sentAt: true },
    }),

    // Active client count
    prisma.subscription.count({ where: { status: "ACTIVE" } }),
  ]);

  // Recent failed messages as error indicators
  const recentErrors = await prisma.messageLog.findMany({
    where: {
      failedAt: { not: null },
      sentAt: {
        gte: (() => {
          const d = new Date();
          d.setDate(d.getDate() - 7);
          return d;
        })(),
      },
    },
    orderBy: { sentAt: "desc" },
    take: 20,
    select: {
      id: true,
      userId: true,
      channel: true,
      category: true,
      failureReason: true,
      sentAt: true,
    },
  });

  return {
    lastDailyReview: lastDailyMsg?.sentAt ?? null,
    lastWeeklyDigest: lastDigestMsg?.sentAt ?? null,
    recentErrors,
    activeClientCount: activeCount,
  };
}

// ============================================================
// WORKOUT OVERRIDE
// ============================================================

/**
 * Admin override for a workout session — partial update.
 */
export async function overrideWorkoutSession(
  sessionId: string,
  data: {
    title?: string;
    description?: string;
    sessionType?: string;
    prescribedDuration?: number;
    prescribedTSS?: number;
    status?: string;
    content?: Record<string, unknown>;
    athleteNotes?: string;
  }
): Promise<unknown> {
  const session = await prisma.workoutSession.findUnique({
    where: { id: sessionId },
    include: { workoutPlan: { select: { id: true, athleteProfileId: true } } },
  });

  if (!session) {
    const err = new Error("Workout session not found") as Error & { statusCode?: number };
    err.statusCode = 404;
    throw err;
  }

  const updateData: Prisma.WorkoutSessionUpdateInput = {};

  if (data.title !== undefined) updateData.title = data.title;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.sessionType !== undefined) updateData.sessionType = data.sessionType as Prisma.EnumSessionTypeFieldUpdateOperationsInput["set"];
  if (data.prescribedDuration !== undefined) updateData.prescribedDuration = data.prescribedDuration;
  if (data.prescribedTSS !== undefined) updateData.prescribedTSS = data.prescribedTSS;
  if (data.status !== undefined) updateData.status = data.status as Prisma.EnumSessionStatusFieldUpdateOperationsInput["set"];
  if (data.content !== undefined) updateData.content = data.content as unknown as Prisma.InputJsonValue;
  if (data.athleteNotes !== undefined) updateData.athleteNotes = data.athleteNotes;

  const updated = await prisma.workoutSession.update({
    where: { id: sessionId },
    data: updateData,
  });

  // Log the override as an adjustment
  await prisma.adjustmentLog.create({
    data: {
      workoutPlanId: session.workoutPlanId,
      triggerEvent: "admin_override",
      triggerData: { sessionId, changes: data } as unknown as Prisma.InputJsonValue,
      adjustmentType: "admin_override",
      description: `Admin override on session "${session.title}": ${Object.keys(data).join(", ")} updated.`,
      affectedSessions: [sessionId],
    },
  });

  logger.info({ sessionId, changes: Object.keys(data) }, "Workout session overridden by admin");

  return updated;
}

// ============================================================
// Helpers
// ============================================================

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  const day = d.getUTCDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  return d;
}

async function getConsecutiveMissedForAdmin(userId: string): Promise<number> {
  const profile = await prisma.athleteProfile.findUnique({
    where: { userId },
  });
  if (!profile) return 0;

  const recentSessions = await prisma.workoutSession.findMany({
    where: {
      workoutPlan: { athleteProfileId: profile.id },
      scheduledDate: { lte: new Date() },
    },
    orderBy: { scheduledDate: "desc" },
    take: 30,
    select: { status: true },
  });

  let streak = 0;
  for (const session of recentSessions) {
    if (session.status === "MISSED" || session.status === "SKIPPED") {
      streak++;
    } else if (session.status === "COMPLETED") {
      break;
    } else {
      break;
    }
  }
  return streak;
}
