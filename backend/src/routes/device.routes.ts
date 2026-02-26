import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import type { DataSource } from "@prisma/client";
import { authenticate } from "../middleware/auth.js";
import { deviceProviderEnum } from "./schemas/device.schemas.js";
import * as deviceService from "../services/device.service.js";

const router = Router();

// All device routes require authentication
router.use(authenticate);

// ============================================================
// GET /device/providers — list supported providers with connection status
// ============================================================

router.get(
  "/providers",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;
      const providers = await deviceService.getProviders(userId);

      res.status(200).json({
        success: true,
        data: { providers },
      });
    } catch (err) {
      next(err);
    }
  }
);

// ============================================================
// POST /device/connect/:provider — initiate device connection
// ============================================================

router.post(
  "/connect/:provider",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;
      const provider = req.params.provider as string;

      // Validate provider param
      const parsed = deviceProviderEnum.safeParse(provider);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: `Invalid provider. Supported: ${deviceProviderEnum.options.join(", ")}`,
        });
        return;
      }

      const result = await deviceService.connect(userId, parsed.data as DataSource);

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
// GET /device/callback/:provider — OAuth callback handler (Phase 2)
// ============================================================

router.get(
  "/callback/:provider",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;
      const provider = req.params.provider as string;

      const parsed = deviceProviderEnum.safeParse(provider);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: `Invalid provider. Supported: ${deviceProviderEnum.options.join(", ")}`,
        });
        return;
      }

      const code = req.query.code as string;
      if (!code) {
        res.status(400).json({
          success: false,
          error: "Missing authorization code",
        });
        return;
      }

      const connection = await deviceService.handleCallback(
        parsed.data as DataSource,
        code,
        userId
      );

      res.status(200).json({
        success: true,
        data: { connection },
      });
    } catch (err) {
      next(err);
    }
  }
);

// ============================================================
// POST /device/sync/:provider — trigger manual sync
// ============================================================

router.post(
  "/sync/:provider",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;
      const provider = req.params.provider as string;

      const parsed = deviceProviderEnum.safeParse(provider);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: `Invalid provider. Supported: ${deviceProviderEnum.options.join(", ")}`,
        });
        return;
      }

      const result = await deviceService.syncDevice(userId, parsed.data as DataSource);

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
// DELETE /device/:provider — disconnect device
// ============================================================

router.delete(
  "/:provider",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;
      const provider = req.params.provider as string;

      const parsed = deviceProviderEnum.safeParse(provider);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: `Invalid provider. Supported: ${deviceProviderEnum.options.join(", ")}`,
        });
        return;
      }

      const result = await deviceService.disconnect(userId, parsed.data as DataSource);

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
