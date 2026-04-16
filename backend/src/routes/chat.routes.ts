import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { authenticate } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { chatSendLimiter } from "../middleware/rateLimiter.js";
import { sendChatMessageSchema } from "./schemas/chat.schemas.js";
import * as chatService from "../services/chat.service.js";

const router = Router();

// All chat routes require authentication
router.use(authenticate);

// GET /chat/history — load conversation history
router.get(
  "/history",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;
      const data = await chatService.getHistory(userId);

      res.status(200).json({
        success: true,
        data,
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /chat/send — send a message and get AI response
router.post(
  "/send",
  chatSendLimiter,
  validate(sendChatMessageSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;
      const { message } = req.body;

      const data = await chatService.sendMessage(userId, message);

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
