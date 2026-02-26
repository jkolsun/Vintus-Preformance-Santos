import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { validate } from "../middleware/validate.js";
import {
  simpleIntakeSchema,
  expandedIntakeSchema,
} from "./schemas/intake.schemas.js";
import * as intakeService from "../services/intake.service.js";

const router = Router();

// POST /intake/simple — public (no auth) — accepts SimpleIntakeSchema
router.post(
  "/simple",
  validate(simpleIntakeSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await intakeService.submitSimpleIntake(req.body);

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /intake/full — public (no auth) — accepts ExpandedIntakeSchema
router.post(
  "/full",
  validate(expandedIntakeSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await intakeService.submitExpandedIntake(req.body);

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /intake/results/:profileId — public — returns AI summary + plans
router.get(
  "/results/:profileId",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const profileId = req.params.profileId as string;
      const result = await intakeService.getIntakeResults(profileId);

      if (!result) {
        res.status(404).json({
          success: false,
          error: "Intake results not found for this profile",
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

export default router;
