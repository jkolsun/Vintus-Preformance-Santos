import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { authenticate } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { completeSessionSchema, skipSessionSchema } from "./schemas/workout.schemas.js";
import { prisma } from "../lib/prisma.js";
import { logger } from "../lib/logger.js";
import { updateAdherence } from "../services/adherence.service.js";

const router = Router();

// All workout routes require authentication
router.use(authenticate);

// POST /workout/:sessionId/complete — mark session completed
router.post(
  "/:sessionId/complete",
  validate(completeSessionSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;
      const sessionId = req.params.sessionId as string;

      // Verify session belongs to this user
      const profile = await prisma.athleteProfile.findUnique({
        where: { userId },
      });

      if (!profile) {
        res.status(404).json({ success: false, error: "Athlete profile not found" });
        return;
      }

      const session = await prisma.workoutSession.findFirst({
        where: {
          id: sessionId,
          workoutPlan: { athleteProfileId: profile.id },
        },
        include: { workoutPlan: true },
      });

      if (!session) {
        res.status(404).json({ success: false, error: "Workout session not found" });
        return;
      }

      if (session.status === "COMPLETED") {
        res.status(409).json({ success: false, error: "Session already completed" });
        return;
      }

      const { actualDuration, rpe, athleteNotes } = req.body;

      // Update session
      const updated = await prisma.workoutSession.update({
        where: { id: sessionId },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
          actualDuration,
          rpe,
          athleteNotes: athleteNotes ?? null,
        },
      });

      // Update plan actualTSS (estimate from RPE and duration)
      const estimatedTSS = Math.round(actualDuration * (rpe / 10) * 1.5);
      await prisma.workoutPlan.update({
        where: { id: session.workoutPlanId },
        data: {
          actualTSS: { increment: estimatedTSS },
        },
      });

      // Update adherence for this week
      await updateAdherence(userId, session.scheduledDate);

      logger.info(
        { userId, sessionId, rpe, actualDuration },
        "Workout session completed"
      );

      res.status(200).json({
        success: true,
        data: updated,
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /workout/:sessionId/skip — mark session skipped
router.post(
  "/:sessionId/skip",
  validate(skipSessionSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;
      const sessionId = req.params.sessionId as string;

      const profile = await prisma.athleteProfile.findUnique({
        where: { userId },
      });

      if (!profile) {
        res.status(404).json({ success: false, error: "Athlete profile not found" });
        return;
      }

      const session = await prisma.workoutSession.findFirst({
        where: {
          id: sessionId,
          workoutPlan: { athleteProfileId: profile.id },
        },
      });

      if (!session) {
        res.status(404).json({ success: false, error: "Workout session not found" });
        return;
      }

      if (session.status === "COMPLETED") {
        res.status(409).json({ success: false, error: "Cannot skip a completed session" });
        return;
      }

      const updated = await prisma.workoutSession.update({
        where: { id: sessionId },
        data: {
          status: "SKIPPED",
          athleteNotes: req.body.reason ?? null,
        },
      });

      // Update adherence for this week
      await updateAdherence(userId, session.scheduledDate);

      logger.info({ userId, sessionId }, "Workout session skipped");

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
