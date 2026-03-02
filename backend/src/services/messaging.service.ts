import type { MessageChannel, MessageCategory } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { logger } from "../lib/logger.js";
import { env } from "../config/env.js";
import { sendSMS } from "../lib/twilio.js";
import { sendEmail } from "../lib/resend.js";
import { generateMessage } from "./ai.service.js";
import { messageTemplates, type MessageTemplate } from "../data/message-templates.js";

/**
 * Messaging Service — template selection, delivery, and logging.
 */

// ============================================================
// Types
// ============================================================

interface MessageContext {
  firstName?: string;
  workoutTitle?: string;
  completedCount?: number;
  adherenceRate?: number;
  hrvMs?: number;
  sleepScore?: number;
  sleepDurationMin?: number;
  trainingDaysPerWeek?: number;
  bookingLink?: string;
  checkInLink?: string;
  perceivedEnergy?: number;
  perceivedSoreness?: number;
  perceivedMood?: number;
  sleepQualityManual?: number;
  readinessTone?: "supportive" | "energized" | "balanced";
  readinessFlags?: string[];
  [key: string]: unknown;
}

interface SendResult {
  messageId: string;
  content: string;
  channel: string;
}

// ============================================================
// interpolateTemplate — replace {{variables}}
// ============================================================

function interpolateTemplate(
  template: string,
  context: MessageContext
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    const value = context[key];
    if (value == null) return "";
    if (typeof value === "number" && key === "adherenceRate") {
      return `${Math.round(value * 100)}%`;
    }
    return String(value);
  });
}

// ============================================================
// Email subject line by category
// ============================================================

function getSubjectForCategory(category: string): string {
  const subjects: Record<string, string> = {
    WELCOME: "Welcome to Vintus Performance",
    WORKOUT_COMPLETED: "Session Logged",
    WORKOUT_MISSED: "Plan Updated",
    ESCALATION: "Let's Check In",
    MOTIVATION: "Today's Focus",
    RECOVERY_TIP: "Recovery Insight",
    CHECK_IN: "Daily Check-In",
    CHECKIN_RESPONSE: "Your Readiness Update",
    SYSTEM: "Vintus Update",
    HUMOR: "A Quick Note",
    EDUCATION: "Training Insight",
    ACCOUNTABILITY: "Today's Plan",
  };
  return subjects[category] ?? "Vintus Performance";
}

// ============================================================
// sendMessage — core messaging function
// ============================================================

export async function sendMessage(
  userId: string,
  category: string,
  channel: "SMS" | "EMAIL",
  context?: MessageContext
): Promise<SendResult> {
  // Get user details for sending
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { athleteProfile: true },
  });

  if (!user) {
    const err = new Error("User not found") as Error & { statusCode?: number };
    err.statusCode = 404;
    throw err;
  }

  // Per-client messaging kill switch
  if (user.athleteProfile?.messagingDisabled) {
    logger.info({ userId, category, channel }, "Message skipped (messagingDisabled=true for this client)");
    return {
      messageId: "disabled-" + userId,
      content: "",
      channel,
    };
  }

  // Build context with user data
  const fullContext: MessageContext = {
    firstName: user.athleteProfile?.firstName ?? "",
    trainingDaysPerWeek: user.athleteProfile?.trainingDaysPerWeek,
    ...context,
  };

  // 1. Filter templates by category + channel compatibility
  const categoryTemplates = messageTemplates[category] ?? [];
  let channelCompatible = categoryTemplates.filter(
    (t) => t.channel === channel || t.channel === "BOTH"
  );

  // 1b. Tone-aware filtering for CHECKIN_RESPONSE templates
  if (fullContext.readinessTone && channelCompatible.length > 0) {
    const toneTagMap: Record<string, string> = {
      supportive: "low-readiness",
      energized: "high-readiness",
      balanced: "mixed-readiness",
    };
    const toneTag = toneTagMap[fullContext.readinessTone];
    if (toneTag) {
      const toneMatched = channelCompatible.filter(
        (t) => t.tags.includes(toneTag) || t.tags.includes("generic")
      );
      // Only narrow the pool if tone-matched templates exist
      if (toneMatched.length > 0) {
        channelCompatible = toneMatched;
      }
    }
  }

  // 2. Exclude templates used within their cooldownHours
  const recentLogs = await prisma.messageLog.findMany({
    where: { userId },
    orderBy: { sentAt: "desc" },
    take: 50,
    select: { templateId: true, content: true, sentAt: true },
  });

  const now = new Date();
  const notOnCooldown = channelCompatible.filter((t) => {
    const lastUse = recentLogs.find((log) => log.templateId === t.id);
    if (!lastUse) return true;
    const hoursSinceUse = (now.getTime() - lastUse.sentAt.getTime()) / (1000 * 60 * 60);
    return hoursSinceUse >= t.cooldownHours;
  });

  // 3. Exclude templates matching last 5 messages (content dedup)
  const last5Contents = recentLogs.slice(0, 5).map((log) => log.content);
  const deduped = notOnCooldown.filter((t) => {
    const interpolated = interpolateTemplate(t.content, fullContext);
    return !last5Contents.includes(interpolated);
  });

  // 4. Pick randomly from remaining pool
  let messageContent: string;
  let templateId: string | null = null;

  if (deduped.length > 0) {
    const selected = deduped[Math.floor(Math.random() * deduped.length)];
    messageContent = interpolateTemplate(selected.content, fullContext);
    templateId = selected.id;
  } else if (notOnCooldown.length > 0) {
    // Cooldown-passed but content-duped — still better than AI
    const selected = notOnCooldown[Math.floor(Math.random() * notOnCooldown.length)];
    messageContent = interpolateTemplate(selected.content, fullContext);
    templateId = selected.id;
  } else {
    // 5. Pool empty — call AI for a fresh message
    const previousMessages = last5Contents;
    const aiResult = await generateMessage(
      category,
      { ...fullContext, channel },
      previousMessages
    );
    messageContent = aiResult.content;
    templateId = aiResult.templateId;
  }

  // Send via appropriate channel
  let externalId: string | null = null;
  let failedAt: Date | undefined;
  let failureReason: string | undefined;

  if (channel === "SMS") {
    const phone = user.athleteProfile?.phone;
    if (phone) {
      externalId = await sendSMS(phone, messageContent);
      if (!externalId) {
        failedAt = new Date();
        failureReason = "SMS delivery failed";
      }
    } else {
      failedAt = new Date();
      failureReason = "No phone number on file";
      logger.warn({ userId }, "Cannot send SMS: no phone number on profile");
    }
  } else {
    const subject = getSubjectForCategory(category);
    externalId = await sendEmail(user.email, subject, messageContent);
    if (!externalId) {
      failedAt = new Date();
      failureReason = "Email delivery failed";
    }
  }

  // Log in MessageLog
  const log = await prisma.messageLog.create({
    data: {
      userId,
      channel: channel as MessageChannel,
      category: category as MessageCategory,
      templateId,
      content: messageContent,
      externalId,
      failedAt,
      failureReason,
    },
  });

  logger.info(
    { userId, messageId: log.id, category, channel, templateId, externalId },
    "Message sent and logged"
  );

  return {
    messageId: log.id,
    content: messageContent,
    channel,
  };
}

// ============================================================
// sendWelcomeSequence — 3 messages over 24 hours
// ============================================================

export async function sendWelcomeSequence(userId: string): Promise<void> {
  // 1. Immediate SMS welcome
  try {
    await sendMessage(userId, "WELCOME", "SMS");
  } catch (err) {
    logger.error({ err, userId }, "Welcome SMS failed");
  }

  // 2. +2 hours: email with full summary
  setTimeout(async () => {
    try {
      await sendMessage(userId, "WELCOME", "EMAIL");
    } catch (err) {
      logger.error({ err, userId }, "Welcome email failed");
    }
  }, 2 * 60 * 60 * 1000);

  // 3. +24 hours: follow-up SMS
  setTimeout(async () => {
    try {
      await sendMessage(userId, "CHECK_IN", "SMS", {
        checkInLink: `${env.FRONTEND_URL}/dashboard/checkin`,
      });
    } catch (err) {
      logger.error({ err, userId }, "Welcome follow-up SMS failed");
    }
  }, 24 * 60 * 60 * 1000);

  logger.info({ userId }, "Welcome sequence initiated (3 messages scheduled)");
}

// ============================================================
// getRecentMessages — last N messages for a user
// ============================================================

export async function getRecentMessages(
  userId: string,
  count: number
): Promise<unknown[]> {
  const messages = await prisma.messageLog.findMany({
    where: { userId },
    orderBy: { sentAt: "desc" },
    take: count,
    select: {
      id: true,
      channel: true,
      category: true,
      templateId: true,
      content: true,
      sentAt: true,
      deliveredAt: true,
      failedAt: true,
      failureReason: true,
      externalId: true,
    },
  });

  return messages;
}

// ============================================================
// getMessageStats — aggregate stats for a user
// ============================================================

export async function getMessageStats(userId: string): Promise<{
  totalSent: number;
  byCategory: Record<string, number>;
  lastSentAt: Date | null;
}> {
  const [totalSent, lastMessage, categoryGroups] = await Promise.all([
    prisma.messageLog.count({ where: { userId } }),
    prisma.messageLog.findFirst({
      where: { userId },
      orderBy: { sentAt: "desc" },
      select: { sentAt: true },
    }),
    prisma.messageLog.groupBy({
      by: ["category"],
      where: { userId },
      _count: { id: true },
    }),
  ]);

  const byCategory: Record<string, number> = {};
  for (const group of categoryGroups) {
    byCategory[group.category] = group._count.id;
  }

  return {
    totalSent,
    byCategory,
    lastSentAt: lastMessage?.sentAt ?? null,
  };
}

// ============================================================
// scheduleCheckinResponse — personalized SMS 3 min after check-in
// ============================================================

const pendingCheckinResponses = new Map<string, NodeJS.Timeout>();

interface CheckinData {
  perceivedEnergy: number;
  perceivedSoreness: number;
  perceivedMood: number;
  sleepQualityManual: number;
}

export async function scheduleCheckinResponse(
  userId: string,
  checkinData: CheckinData,
  flags: string[]
): Promise<void> {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const dateStr = today.toISOString().split("T")[0];
  const dedupKey = `checkin-response:${userId}:${dateStr}`;

  // Debounce — if user resubmits within 3 min, reset the timer
  const existingTimeout = pendingCheckinResponses.get(dedupKey);
  if (existingTimeout) {
    clearTimeout(existingTimeout);
    logger.info({ userId }, "Check-in response debounced (re-submission)");
  }

  // Compute readiness tone from composite score
  const composite = (
    checkinData.perceivedEnergy +
    checkinData.perceivedMood +
    checkinData.sleepQualityManual +
    (11 - checkinData.perceivedSoreness)
  ) / 4;

  let readinessTone: "supportive" | "energized" | "balanced";
  if (composite < 4.5) {
    readinessTone = "supportive";
  } else if (composite > 7) {
    readinessTone = "energized";
  } else {
    readinessTone = "balanced";
  }

  const DELAY_MS = 3 * 60 * 1000; // 3 minutes

  const timeout = setTimeout(async () => {
    pendingCheckinResponses.delete(dedupKey);

    try {
      // DB dedup — check if already sent today
      const existingResponse = await prisma.messageLog.findFirst({
        where: {
          userId,
          category: "CHECKIN_RESPONSE" as MessageCategory,
          sentAt: { gte: today },
        },
      });

      if (existingResponse) {
        logger.info({ userId }, "Check-in response already sent today, skipping");
        return;
      }

      await sendMessage(userId, "CHECKIN_RESPONSE", "SMS", {
        perceivedEnergy: checkinData.perceivedEnergy,
        perceivedSoreness: checkinData.perceivedSoreness,
        perceivedMood: checkinData.perceivedMood,
        sleepQualityManual: checkinData.sleepQualityManual,
        readinessTone,
        readinessFlags: flags,
      });

      logger.info(
        { userId, readinessTone, flags },
        "Check-in response SMS sent"
      );
    } catch (err) {
      logger.error({ err, userId }, "Check-in response SMS failed");
    }
  }, DELAY_MS);

  pendingCheckinResponses.set(dedupKey, timeout);

  logger.info(
    { userId, readinessTone, delayMs: DELAY_MS },
    "Check-in response SMS scheduled"
  );
}
