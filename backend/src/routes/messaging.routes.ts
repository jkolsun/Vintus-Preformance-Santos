import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { authenticate } from "../middleware/auth.js";
import { adminOnly } from "../middleware/adminOnly.js";
import { validate } from "../middleware/validate.js";
import { sendMessageSchema } from "./schemas/messaging.schemas.js";
import * as messagingService from "../services/messaging.service.js";
import { messageTemplates } from "../data/message-templates.js";

const router = Router();

// All messaging routes require authentication + admin role
router.use(authenticate);
router.use(adminOnly);

// POST /messaging/send — admin only — send a message to a user
router.post(
  "/send",
  validate(sendMessageSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId, category, channel, context } = req.body;
      const result = await messagingService.sendMessage(
        userId,
        category,
        channel,
        context
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

// GET /messaging/history/:userId — admin only — returns message history
router.get(
  "/history/:userId",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.params.userId as string;
      const count = parseInt(req.query.count as string, 10) || 50;
      const clampedCount = Math.min(Math.max(count, 1), 200);

      const messages = await messagingService.getRecentMessages(userId, clampedCount);
      const stats = await messagingService.getMessageStats(userId);

      res.status(200).json({
        success: true,
        data: {
          messages,
          stats,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /messaging/templates — admin only — returns all templates grouped by category
router.get(
  "/templates",
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const grouped: Record<string, { count: number; templates: unknown[] }> = {};

      for (const [category, templates] of Object.entries(messageTemplates)) {
        grouped[category] = {
          count: templates.length,
          templates: templates.map((t) => ({
            id: t.id,
            channel: t.channel,
            content: t.content,
            cooldownHours: t.cooldownHours,
            tags: t.tags,
          })),
        };
      }

      res.status(200).json({
        success: true,
        data: grouped,
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
