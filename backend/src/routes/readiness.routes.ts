import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { authenticate } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { checkinSchema } from "./schemas/readiness.schemas.js";
import * as readinessService from "../services/readiness.service.js";

const router = Router();

// All readiness routes require authentication
router.use(authenticate);

// POST /readiness/checkin — daily readiness check-in (upsert for today)
router.post(
  "/checkin",
  validate(checkinSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;
      const result = await readinessService.submitCheckin(userId, req.body);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /readiness/history — last N days (default 14)
router.get(
  "/history",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;
      const days = parseInt(req.query.days as string, 10) || 14;
      const clampedDays = Math.min(Math.max(days, 1), 365);

      const data = await readinessService.getHistory(userId, clampedDays);

      res.status(200).json({
        success: true,
        data,
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /readiness/trends — last 14 vs previous 14 days
router.get(
  "/trends",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;
      const data = await readinessService.getTrends(userId);

      res.status(200).json({
        success: true,
        data,
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
