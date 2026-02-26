import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { authenticate } from "../middleware/auth.js";
import * as dashboardService from "../services/dashboard.service.js";

const router = Router();

// All dashboard routes require authentication
router.use(authenticate);

// GET /dashboard/overview — full dashboard data
router.get(
  "/overview",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;
      const data = await dashboardService.getOverview(userId);

      res.status(200).json({
        success: true,
        data,
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /dashboard/week/:weekOffset — week plan + sessions
router.get(
  "/week/:weekOffset",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;
      const weekOffset = parseInt(req.params.weekOffset as string, 10);

      if (isNaN(weekOffset) || weekOffset < -52 || weekOffset > 4) {
        res.status(400).json({
          success: false,
          error: "weekOffset must be a number between -52 and 4",
        });
        return;
      }

      const data = await dashboardService.getWeekView(userId, weekOffset);

      res.status(200).json({
        success: true,
        data,
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /dashboard/workout/:sessionId — full workout content
router.get(
  "/workout/:sessionId",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;
      const sessionId = req.params.sessionId as string;

      const data = await dashboardService.getWorkoutDetail(userId, sessionId);

      res.status(200).json({
        success: true,
        data,
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /dashboard/history — paginated past workouts
router.get(
  "/history",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 20;
      const clampedPage = Math.max(page, 1);
      const clampedLimit = Math.min(Math.max(limit, 1), 100);

      const data = await dashboardService.getWorkoutHistory(userId, clampedPage, clampedLimit);

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
