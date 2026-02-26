import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { authenticate } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { createCheckoutSchema } from "./schemas/checkout.schemas.js";
import * as checkoutService from "../services/checkout.service.js";
import { prisma } from "../lib/prisma.js";

const router = Router();

// POST /checkout/session — creates Stripe Checkout session, returns { url }
// Public: new users pass profileId; authenticated users use their token
router.post(
  "/session",
  validate(createCheckoutSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tier, successUrl, cancelUrl, profileId } = req.body;

      let userId: string | undefined;

      // Try to extract userId from auth token (if present)
      try {
        await new Promise<void>((resolve, reject) => {
          authenticate(req, res, (err?: unknown) => {
            if (err) reject(err);
            else resolve();
          });
        });
        userId = req.user?.userId;
      } catch {
        // No valid token — that's fine for new users
      }

      // If no auth, require profileId and look up userId from the profile
      if (!userId) {
        if (!profileId) {
          res.status(400).json({
            success: false,
            error: "Authentication or profileId is required",
          });
          return;
        }

        const profile = await prisma.athleteProfile.findUnique({
          where: { id: profileId },
          select: { userId: true },
        });

        if (!profile) {
          res.status(404).json({
            success: false,
            error: "Profile not found",
          });
          return;
        }

        userId = profile.userId;
      }

      const result = await checkoutService.createCheckoutSession(
        tier,
        userId,
        successUrl,
        cancelUrl
      );

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
);

// All remaining checkout routes require authentication
router.use(authenticate);

// GET /checkout/status — returns current user's subscription status
router.get(
  "/status",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;
      const result = await checkoutService.getSubscriptionStatus(userId);

      if (!result) {
        res.status(200).json({
          success: true,
          data: null,
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /checkout/portal — returns Stripe Customer Portal URL
router.post(
  "/portal",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;
      const result = await checkoutService.createPortalSession(userId);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
