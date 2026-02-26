import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { authenticate } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import {
  verifySessionSchema,
  setPasswordSchema,
  routineQuestionnaireSchema,
  deviceSelectionSchema,
} from "./schemas/onboarding.schemas.js";
import * as onboardingService from "../services/onboarding.service.js";

const router = Router();

// POST /onboarding/verify-session — public — body: { sessionId }
router.post(
  "/verify-session",
  validate(verifySessionSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await onboardingService.verifyCheckoutSession(req.body.sessionId);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /onboarding/set-password — public — body: { userId, password }
router.post(
  "/set-password",
  validate(setPasswordSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId, sessionId, password } = req.body;
      const result = await onboardingService.setInitialPassword(userId, sessionId, password);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /onboarding/routine — requires auth — body: RoutineQuestionnaireSchema
router.post(
  "/routine",
  authenticate,
  validate(routineQuestionnaireSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;
      const result = await onboardingService.submitRoutineQuestionnaire(userId, req.body);

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /onboarding/device — requires auth — body: DeviceSelectionSchema
router.post(
  "/device",
  authenticate,
  validate(deviceSelectionSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;
      const result = await onboardingService.initiateDeviceConnection(
        userId,
        req.body.provider
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

// GET /onboarding/status — requires auth — returns step completion
router.get(
  "/status",
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;
      const result = await onboardingService.getOnboardingStatus(userId);

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
