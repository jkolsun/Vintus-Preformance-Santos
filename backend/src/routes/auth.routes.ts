import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { authenticate } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import {
  registerSchema,
  loginSchema,
  changePasswordSchema,
} from "./schemas/auth.schemas.js";
import * as authService from "../services/auth.service.js";
import { prisma } from "../lib/prisma.js";
import { env } from "../config/env.js";

const router = Router();

const cookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: "/",
};

// POST /auth/register
router.post(
  "/register",
  validate(registerSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password, firstName, lastName } = req.body;
      const result = await authService.register(email, password, firstName, lastName);

      res.cookie("vintus_token", result.token, cookieOptions);

      res.status(201).json({
        success: true,
        data: { token: result.token, userId: result.userId },
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /auth/login
router.post(
  "/login",
  validate(loginSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body;
      const result = await authService.login(email, password);

      res.cookie("vintus_token", result.token, cookieOptions);

      res.status(200).json({
        success: true,
        data: { token: result.token, userId: result.userId, role: result.role },
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /auth/logout — requires auth
router.post(
  "/logout",
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Extract the token that was used to authenticate
      let token: string | undefined;
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith("Bearer ")) {
        token = authHeader.slice(7);
      }
      if (!token && req.cookies?.vintus_token) {
        token = req.cookies.vintus_token as string;
      }

      if (token) {
        await authService.logout(token);
      }

      res.clearCookie("vintus_token", { path: "/" });

      res.status(200).json({ success: true, data: { message: "Logged out" } });
    } catch (err) {
      next(err);
    }
  }
);

// GET /auth/me — requires auth — returns current user + profile
router.get(
  "/me",
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user!.userId },
        select: {
          id: true,
          email: true,
          role: true,
          createdAt: true,
          athleteProfile: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phone: true,
              timezone: true,
              primaryGoal: true,
              experienceLevel: true,
              personaType: true,
              aiSummary: true,
            },
          },
          subscription: {
            select: {
              id: true,
              planTier: true,
              status: true,
              currentPeriodEnd: true,
            },
          },
        },
      });

      if (!user) {
        res.status(404).json({ success: false, error: "User not found" });
        return;
      }

      res.status(200).json({ success: true, data: { user } });
    } catch (err) {
      next(err);
    }
  }
);

// PUT /auth/password — requires auth
router.put(
  "/password",
  authenticate,
  validate(changePasswordSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { oldPassword, newPassword } = req.body;
      await authService.changePassword(req.user!.userId, oldPassword, newPassword);

      res.clearCookie("vintus_token", { path: "/" });

      res.status(200).json({
        success: true,
        data: { message: "Password changed. Please log in again." },
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
