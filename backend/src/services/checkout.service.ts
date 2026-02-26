import type Stripe from "stripe";
import type { PlanTier, SubscriptionStatus } from "@prisma/client";
import { stripe } from "../config/stripe.js";
import { prisma } from "../lib/prisma.js";
import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";

// ============================================================
// Product → Stripe Price ID mapping
// ============================================================

const TIER_PRICE_MAP: Record<PlanTier, string> = {
  PRIVATE_COACHING: env.STRIPE_PRICE_PRIVATE_COACHING,
  TRAINING_30DAY: env.STRIPE_PRICE_TRAINING_30DAY,
  TRAINING_60DAY: env.STRIPE_PRICE_TRAINING_60DAY,
  TRAINING_90DAY: env.STRIPE_PRICE_TRAINING_90DAY,
  NUTRITION_4WEEK: env.STRIPE_PRICE_NUTRITION_4WEEK,
  NUTRITION_8WEEK: env.STRIPE_PRICE_NUTRITION_8WEEK,
};

// Which tiers are recurring subscriptions vs one-time payments
const RECURRING_TIERS: Set<PlanTier> = new Set(["PRIVATE_COACHING"]);

// Duration in days for one-time purchases (used to set currentPeriodEnd)
const TIER_DURATION_DAYS: Partial<Record<PlanTier, number>> = {
  TRAINING_30DAY: 30,
  TRAINING_60DAY: 60,
  TRAINING_90DAY: 90,
  NUTRITION_4WEEK: 28,
  NUTRITION_8WEEK: 56,
};

// ============================================================
// createCheckoutSession
// ============================================================

export async function createCheckoutSession(
  tier: PlanTier,
  userId: string,
  successUrl: string,
  cancelUrl: string
): Promise<{ sessionId: string; url: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { subscription: true },
  });

  if (!user) {
    const err = new Error("User not found") as Error & { statusCode?: number };
    err.statusCode = 404;
    throw err;
  }

  const priceId = TIER_PRICE_MAP[tier];
  const isRecurring = RECURRING_TIERS.has(tier);

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: isRecurring ? "subscription" : "payment",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: cancelUrl,
    metadata: { userId, tier },
    allow_promotion_codes: true,
  };

  // Only add subscription_data for recurring products
  if (isRecurring) {
    sessionParams.subscription_data = {
      metadata: { userId, tier },
    };
  }

  // Reuse existing Stripe customer if available
  if (user.subscription?.stripeCustomerId) {
    sessionParams.customer = user.subscription.stripeCustomerId;
  } else {
    sessionParams.customer_email = user.email;
  }

  const session = await stripe.checkout.sessions.create(sessionParams);

  logger.info(
    { userId, tier, sessionId: session.id, mode: sessionParams.mode },
    "Stripe Checkout session created"
  );

  return { sessionId: session.id, url: session.url! };
}

// ============================================================
// handleWebhookEvent
// ============================================================

export async function handleWebhookEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed":
      await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
      break;

    case "customer.subscription.updated":
      await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
      break;

    case "customer.subscription.deleted":
      await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
      break;

    case "invoice.payment_failed":
      await handlePaymentFailed(event.data.object as Stripe.Invoice);
      break;

    default:
      logger.info({ eventType: event.type }, "Unhandled Stripe event type");
  }
}

// ============================================================
// Webhook event handlers
// ============================================================

async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session
): Promise<void> {
  const userId = session.metadata?.userId;
  const tier = session.metadata?.tier as PlanTier | undefined;

  if (!userId || !tier) {
    logger.warn({ sessionId: session.id }, "Checkout completed but missing metadata");
    return;
  }

  const stripeCustomerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id ?? null;

  const isRecurring = RECURRING_TIERS.has(tier);
  let stripeSubscriptionId: string | null = null;
  let currentPeriodStart = new Date();
  let currentPeriodEnd: Date;
  let stripePriceId: string | null = null;

  if (isRecurring) {
    // Subscription mode — retrieve subscription for period dates
    stripeSubscriptionId =
      typeof session.subscription === "string"
        ? session.subscription
        : session.subscription?.id ?? null;

    if (stripeSubscriptionId) {
      const sub = await stripe.subscriptions.retrieve(stripeSubscriptionId);
      currentPeriodStart = new Date(sub.current_period_start * 1000);
      currentPeriodEnd = new Date(sub.current_period_end * 1000);
      stripePriceId = sub.items.data[0]?.price?.id ?? null;
    } else {
      currentPeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    }
  } else {
    // One-time payment — calculate period end from tier duration
    const durationDays = TIER_DURATION_DAYS[tier] ?? 30;
    currentPeriodEnd = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);
    stripePriceId = TIER_PRICE_MAP[tier] ?? null;
  }

  // Upsert subscription record
  await prisma.subscription.upsert({
    where: { userId },
    create: {
      userId,
      planTier: tier,
      stripeCustomerId,
      stripeSubscriptionId,
      stripePriceId,
      status: "ACTIVE",
      currentPeriodStart,
      currentPeriodEnd,
    },
    update: {
      planTier: tier,
      stripeCustomerId,
      stripeSubscriptionId,
      stripePriceId,
      status: "ACTIVE",
      currentPeriodStart,
      currentPeriodEnd,
      cancelAtPeriodEnd: false,
    },
  });

  logger.info(
    { userId, tier, stripeSubscriptionId, isRecurring },
    "Purchase record created from checkout"
  );
}

// Subscription lifecycle events — only apply to PRIVATE_COACHING (recurring)

async function handleSubscriptionUpdated(
  subscription: Stripe.Subscription
): Promise<void> {
  const userId = subscription.metadata?.userId;

  if (!userId) {
    logger.warn(
      { subscriptionId: subscription.id },
      "Subscription updated but missing userId in metadata"
    );
    return;
  }

  const tier = (subscription.metadata?.tier as PlanTier) ?? undefined;
  const stripePriceId = subscription.items.data[0]?.price?.id ?? null;

  // Map Stripe status to our enum
  const statusMap: Record<string, SubscriptionStatus> = {
    active: "ACTIVE",
    past_due: "PAST_DUE",
    canceled: "CANCELED",
    paused: "PAUSED",
    trialing: "TRIALING",
  };
  const status = statusMap[subscription.status] ?? "ACTIVE";

  await prisma.subscription.update({
    where: { userId },
    data: {
      ...(tier ? { planTier: tier } : {}),
      stripePriceId,
      status,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    },
  });

  logger.info(
    { userId, status, tier, subscriptionId: subscription.id },
    "Subscription updated"
  );
}

async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription
): Promise<void> {
  const userId = subscription.metadata?.userId;

  if (!userId) {
    logger.warn(
      { subscriptionId: subscription.id },
      "Subscription deleted but missing userId in metadata"
    );
    return;
  }

  await prisma.subscription.update({
    where: { userId },
    data: { status: "CANCELED" },
  });

  logger.info(
    { userId, subscriptionId: subscription.id },
    "Subscription canceled"
  );
}

async function handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
  const stripeSubscriptionId =
    typeof invoice.subscription === "string"
      ? invoice.subscription
      : invoice.subscription?.id ?? null;

  if (!stripeSubscriptionId) {
    logger.warn({ invoiceId: invoice.id }, "Payment failed but no subscription ID");
    return;
  }

  const subscription = await prisma.subscription.findFirst({
    where: { stripeSubscriptionId },
  });

  if (!subscription) {
    logger.warn(
      { stripeSubscriptionId },
      "Payment failed but subscription not found in DB"
    );
    return;
  }

  await prisma.subscription.update({
    where: { id: subscription.id },
    data: { status: "PAST_DUE" },
  });

  logger.info(
    { userId: subscription.userId, stripeSubscriptionId },
    "Subscription marked PAST_DUE after payment failure"
  );
}

// ============================================================
// getSubscriptionStatus
// ============================================================

export async function getSubscriptionStatus(userId: string): Promise<{
  planTier: PlanTier;
  status: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
} | null> {
  const subscription = await prisma.subscription.findUnique({
    where: { userId },
    select: {
      planTier: true,
      status: true,
      currentPeriodStart: true,
      currentPeriodEnd: true,
      cancelAtPeriodEnd: true,
    },
  });

  return subscription;
}

// ============================================================
// createPortalSession
// ============================================================

export async function createPortalSession(
  userId: string
): Promise<{ url: string }> {
  const subscription = await prisma.subscription.findUnique({
    where: { userId },
  });

  if (!subscription?.stripeCustomerId) {
    const err = new Error("No active subscription found") as Error & { statusCode?: number };
    err.statusCode = 404;
    throw err;
  }

  // Portal only available for recurring subscriptions (Private Coaching)
  if (!subscription.stripeSubscriptionId) {
    const err = new Error("Subscription management is only available for Private Coaching") as Error & { statusCode?: number };
    err.statusCode = 400;
    throw err;
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: subscription.stripeCustomerId,
    return_url: env.FRONTEND_URL,
  });

  logger.info({ userId }, "Stripe Customer Portal session created");

  return { url: session.url };
}
