import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { authenticate } from "../middleware/auth.js";
import { adminOnly } from "../middleware/adminOnly.js";
import { validate } from "../middleware/validate.js";
import {
  clientNotesSchema,
  clientStatusSchema,
  customMessageSchema,
  workoutOverrideSchema,
  profileEditSchema,
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

// PUT /admin/clients/:userId/profile — edit client profile
router.put(
  "/clients/:userId/profile",
  validate(profileEditSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.params.userId as string;
      const result = await adminService.updateClientProfile(userId, req.body);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /admin/action-queue — all items needing admin attention
router.get(
  "/action-queue",
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const queue = await adminService.getActionQueue();

      res.status(200).json({
        success: true,
        data: queue,
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /admin/messages — paginated message feed
router.get(
  "/messages",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 50));
      const category = (req.query.category as string) || undefined;
      const status = (req.query.status as string) || undefined;
      const search = (req.query.search as string) || undefined;
      const date = (req.query.date as string) || undefined;

      const result = await adminService.getMessageFeed({ page, limit, category, status, search, date });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /admin/triggers — pending message triggers awaiting manual send
router.get(
  "/triggers",
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const triggers = await adminService.getPendingTriggers();

      res.status(200).json({
        success: true,
        data: { triggers },
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /admin/triggers/:id/fire — send a pending message trigger
router.post(
  "/triggers/:id/fire",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await adminService.fireTrigger(req.params.id);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /admin/triggers/:id/dismiss — dismiss a pending trigger without sending
router.post(
  "/triggers/:id/dismiss",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await adminService.dismissTrigger(req.params.id);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /admin/pending-count — number of subscriptions awaiting admin approval
router.get(
  "/pending-count",
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const count = await adminService.getPendingApprovalCount();

      res.status(200).json({
        success: true,
        data: { count },
      });
    } catch (err) {
      next(err);
    }
  }
);

// PUT /admin/clients/:userId/status — pause, reactivate, approve, or reject client
router.put(
  "/clients/:userId/status",
  validate(clientStatusSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.params.userId as string;
      const { action } = req.body;

      const result = await adminService.setClientStatus(userId, action);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /admin/clients/:userId — permanently remove client
router.delete(
  "/clients/:userId",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.params.userId as string;

      const result = await adminService.deleteClient(userId);

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
