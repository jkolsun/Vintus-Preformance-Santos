import { Router } from "express";
import express from "express";
import type { Request, Response } from "express";
import { stripe } from "../config/stripe.js";
import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";
import { handleWebhookEvent } from "../services/checkout.service.js";

const router = Router();

// Raw body parser — Stripe signature verification requires the raw request body.
// This route is mounted BEFORE express.json() in index.ts.
router.use(express.raw({ type: "application/json" }));

// POST /api/webhooks/stripe — NO auth middleware
router.post("/stripe", async (req: Request, res: Response) => {
  const signature = req.headers["stripe-signature"];

  if (!signature) {
    logger.warn("Webhook received without stripe-signature header");
    res.status(400).json({ error: "Missing stripe-signature header" });
    return;
  }

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body as Buffer,
      signature as string,
      env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    logger.warn({ err: message }, "Webhook signature verification failed");
    res.status(400).json({ error: `Webhook signature verification failed: ${message}` });
    return;
  }

  logger.info({ eventType: event.type, eventId: event.id }, "Stripe webhook received");

  try {
    await handleWebhookEvent(event);
  } catch (err) {
    // Log error but always return 200 to prevent Stripe from retrying
    logger.error({ err, eventType: event.type, eventId: event.id }, "Webhook handler error");
  }

  // Always return 200 to acknowledge receipt
  res.status(200).json({ received: true });
});

export default router;
