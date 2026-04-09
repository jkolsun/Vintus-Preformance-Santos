import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { prisma } from "../lib/prisma.js";
import { logger } from "../lib/logger.js";

const router = Router();

router.use(authenticate);

// Validation schema for profile update
const updateProfileSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  phone: z.string().min(7).max(20).optional().nullable(),
  timezone: z.string().min(1).max(100).optional(),
});

// PUT /profile — update own athlete profile
router.put(
  "/",
  validate(updateProfileSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;

      const profile = await prisma.athleteProfile.findUnique({
        where: { userId },
      });

      if (!profile) {
        res.status(404).json({ success: false, error: "Athlete profile not found" });
        return;
      }

      const { firstName, lastName, phone, timezone } = req.body;

      const updated = await prisma.athleteProfile.update({
        where: { userId },
        data: {
          ...(firstName !== undefined ? { firstName } : {}),
          ...(lastName !== undefined ? { lastName } : {}),
          ...(phone !== undefined ? { phone } : {}),
          ...(timezone !== undefined ? { timezone } : {}),
        },
        select: {
          firstName: true,
          lastName: true,
          phone: true,
          timezone: true,
        },
      });

      logger.info({ userId }, "Client updated own profile");

      res.status(200).json({
        success: true,
        data: updated,
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
