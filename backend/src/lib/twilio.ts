import Twilio from "twilio";
import { env } from "../config/env.js";
import { logger } from "./logger.js";

const twilioClient = Twilio(
  env.TWILIO_ACCOUNT_SID,
  env.TWILIO_AUTH_TOKEN
);

const TWILIO_PHONE_NUMBER = env.TWILIO_PHONE_NUMBER;

/**
 * Send an SMS via Twilio.
 * Returns the message SID on success, or null on failure.
 */
export async function sendSMS(
  to: string,
  body: string
): Promise<string | null> {
  try {
    const message = await twilioClient.messages.create({
      to,
      from: TWILIO_PHONE_NUMBER,
      body,
    });

    logger.info(
      { sid: message.sid, to, bodyLength: body.length },
      "SMS sent successfully"
    );

    return message.sid;
  } catch (err) {
    const error = err as Error & { code?: number; status?: number };

    // Handle known Twilio errors gracefully
    if (error.code === 21211) {
      logger.warn({ to, errorCode: error.code }, "SMS failed: invalid phone number");
    } else if (error.code === 21608) {
      logger.warn({ to, errorCode: error.code }, "SMS failed: unverified number (trial account)");
    } else if (error.status === 429) {
      logger.warn({ to }, "SMS failed: Twilio rate limit hit");
    } else {
      logger.error({ err, to }, "SMS sending failed");
    }

    return null;
  }
}
