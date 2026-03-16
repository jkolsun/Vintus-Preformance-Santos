import { Router } from "express";
import express from "express";
import type { Request, Response } from "express";
import Twilio from "twilio";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { logger } from "../lib/logger.js";

const router = Router();

// Parse URL-encoded bodies (Twilio sends form data, not JSON)
router.use(express.urlencoded({ extended: false }));

// Opt-out keywords (case-insensitive, punctuation-stripped) — TCPA / CTIA compliance
const OPT_OUT_KEYWORDS = new Set([
  "stop", "unsubscribe", "cancel", "quit", "end",
  "stopall", "stop all",
]);

const OPT_IN_KEYWORDS = new Set([
  "start", "unstop", "subscribe",
]);

const HELP_KEYWORDS = new Set(["help", "info"]);

/**
 * Normalize a phone number to E.164 format for consistent matching.
 * Strips all non-digit characters, prepends +1 for 10-digit US numbers.
 */
function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  // Already has country code or non-US — prepend + if missing
  if (phone.startsWith("+")) return phone;
  return `+${digits}`;
}

/**
 * Sanitize message body for keyword matching.
 * Strips punctuation and extra whitespace, lowercases.
 */
function sanitizeForKeyword(body: string): string {
  return body.toLowerCase().replace(/[^a-z\s]/g, "").replace(/\s+/g, " ").trim();
}

/**
 * POST /api/webhooks/sms — Twilio inbound SMS webhook
 * Handles opt-out keywords (STOP), opt-in (START), HELP, and logs inbound messages.
 * Twilio must be configured to POST to this URL for the messaging number.
 */
router.post("/sms", async (req: Request, res: Response) => {
  try {
    // Validate request is from Twilio (production only)
    if (env.NODE_ENV === "production") {
      const twilioSignature = req.headers["x-twilio-signature"] as string;
      // Derive URL from request (matches what Twilio actually posted to)
      const protocol = req.headers["x-forwarded-proto"] || req.protocol;
      const host = req.headers["x-forwarded-host"] || req.headers.host;
      const url = `${protocol}://${host}${req.originalUrl}`;

      const isValid = Twilio.validateRequest(
        env.TWILIO_AUTH_TOKEN,
        twilioSignature || "",
        url,
        req.body
      );

      if (!isValid) {
        logger.warn({ url }, "Inbound SMS webhook: invalid Twilio signature");
        res.status(403).send("Forbidden");
        return;
      }
    }

    const from = req.body.From as string | undefined;
    const body = (req.body.Body as string | undefined)?.trim() ?? "";
    const messageSid = req.body.MessageSid as string | undefined;

    if (!from) {
      res.status(400).send("Missing From number");
      return;
    }

    const sanitized = sanitizeForKeyword(body);

    logger.info({ from, body: body.substring(0, 100), messageSid }, "Inbound SMS received");

    // Normalize the inbound phone number and find user by both formats
    const normalizedFrom = normalizePhone(from);
    const profile = await prisma.athleteProfile.findFirst({
      where: {
        OR: [
          { phone: from },
          { phone: normalizedFrom },
        ],
      },
      select: { id: true, userId: true, messagingDisabled: true },
    });

    // Handle HELP keywords (CTIA compliance)
    if (HELP_KEYWORDS.has(sanitized)) {
      res.type("text/xml").send(
        `<?xml version="1.0" encoding="UTF-8"?><Response><Message>Vintus Performance — Premium Adaptive Coaching. Visit ${env.FRONTEND_URL} for support. Reply STOP to opt out.</Message></Response>`
      );
      return;
    }

    // Handle opt-out keywords
    if (OPT_OUT_KEYWORDS.has(sanitized)) {
      if (profile) {
        await prisma.athleteProfile.update({
          where: { id: profile.id },
          data: { messagingDisabled: true },
        });
        logger.info({ userId: profile.userId, from }, "Client opted out via SMS (STOP)");
      } else {
        logger.info({ from }, "Opt-out from unknown number");
      }

      res.type("text/xml").send(
        `<?xml version="1.0" encoding="UTF-8"?><Response><Message>You've been unsubscribed from Vintus Performance messages. Reply START to re-subscribe.</Message></Response>`
      );
      return;
    }

    // Handle opt-in keywords
    if (OPT_IN_KEYWORDS.has(sanitized)) {
      if (profile) {
        await prisma.athleteProfile.update({
          where: { id: profile.id },
          data: { messagingDisabled: false },
        });
        logger.info({ userId: profile.userId, from }, "Client opted back in via SMS (START)");
      }

      res.type("text/xml").send(
        `<?xml version="1.0" encoding="UTF-8"?><Response><Message>Welcome back! You've been re-subscribed to Vintus Performance messages.</Message></Response>`
      );
      return;
    }

    // Log inbound message for coach visibility
    if (profile) {
      await prisma.messageLog.create({
        data: {
          userId: profile.userId,
          channel: "SMS",
          category: "SYSTEM",
          content: body,
          externalId: messageSid ?? null,
          templateId: "inbound-sms",
        },
      });
    }

    // Empty TwiML response (no auto-reply for regular messages)
    res.type("text/xml").send(
      `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`
    );
  } catch (err) {
    // Always return 200 with empty TwiML to prevent Twilio retries
    logger.error({ err }, "SMS webhook handler error");
    res.type("text/xml").status(200).send(
      `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`
    );
  }
});

export default router;
