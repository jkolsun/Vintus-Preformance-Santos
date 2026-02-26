import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { authenticate } from "../middleware/auth.js";
import { adminOnly } from "../middleware/adminOnly.js";
import { validate } from "../middleware/validate.js";
import {
  clientNotesSchema,
  customMessageSchema,
  workoutOverrideSchema,
} from "./schemas/admin.schemas.js";
import { dailyReviewForClient } from "../services/cron.service.js";
import * as adminService from "../services/admin.service.js";

const router = Router();

// All admin routes require authentication + admin role
router.use(authenticate);
router.use(adminOnly);

// ============================================================
// CLIENT MANAGEMENT
// ============================================================

// GET /admin/clients — paginated list with filters
router.get(
  "/clients",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
      const search = (req.query.search as string) || undefined;
      const tier = (req.query.tier as string) || undefined;
      const status = (req.query.status as string) || undefined;

      const result = await adminService.getClients({ page, limit, search, tier, status });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /admin/clients/:userId — full client detail
router.get(
  "/clients/:userId",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.params.userId as string;
      const detail = await adminService.getClientDetail(userId);

      res.status(200).json({
        success: true,
        data: detail,
      });
    } catch (err) {
      next(err);
    }
  }
);

// PUT /admin/clients/:userId/notes — add admin notes
router.put(
  "/clients/:userId/notes",
  validate(clientNotesSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.params.userId as string;
      const { notes } = req.body;

      const result = await adminService.updateClientNotes(userId, notes);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /admin/clients/:userId/message — send custom message
router.post(
  "/clients/:userId/message",
  validate(customMessageSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.params.userId as string;
      const { content, channel } = req.body;

      const result = await adminService.sendCustomMessage(userId, content, channel);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
);

// ============================================================
// ANALYTICS
// ============================================================

// GET /admin/analytics/overview — aggregate business metrics
router.get(
  "/analytics/overview",
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const overview = await adminService.getAnalyticsOverview();

      res.status(200).json({
        success: true,
        data: overview,
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /admin/analytics/adherence — aggregate adherence trends
router.get(
  "/analytics/adherence",
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const trends = await adminService.getAdherenceTrends();

      res.status(200).json({
        success: true,
        data: trends,
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /admin/analytics/escalations — recent escalation events
router.get(
  "/analytics/escalations",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
      const resolvedParam = req.query.resolved as string | undefined;
      const resolved =
        resolvedParam === "true" ? true : resolvedParam === "false" ? false : undefined;

      const result = await adminService.getEscalationEvents({ page, limit, resolved });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
);

// ============================================================
// SYSTEM
// ============================================================

// GET /admin/system/health — external service health checks
router.get(
  "/system/health",
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const health = await adminService.getSystemHealth();

      res.status(200).json({
        success: true,
        data: health,
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /admin/system/cron-status — cron job status
router.get(
  "/system/cron-status",
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const status = await adminService.getCronStatus();

      res.status(200).json({
        success: true,
        data: status,
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /admin/system/trigger-review/:userId — manual daily review trigger
router.post(
  "/system/trigger-review/:userId",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.params.userId as string;
      const start = Date.now();

      await dailyReviewForClient(userId);

      res.status(200).json({
        success: true,
        data: {
          message: "Daily review completed",
          userId,
          durationMs: Date.now() - start,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// ============================================================
// WORKOUT OVERRIDE
// ============================================================

// PUT /admin/workout/:sessionId — admin workout override
router.put(
  "/workout/:sessionId",
  validate(workoutOverrideSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sessionId = req.params.sessionId as string;
      const updated = await adminService.overrideWorkoutSession(sessionId, req.body);

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
