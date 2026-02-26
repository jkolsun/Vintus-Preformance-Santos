import type { Request, Response, NextFunction } from "express";
import { verifyToken } from "../services/auth.service.js";
import { logger } from "../lib/logger.js";

/**
 * JWT verification middleware.
 * Checks Authorization header (Bearer token) first, then httpOnly cookie "vintus_token".
 * Verifies token via auth.service.verifyToken (checks JWT + Session in DB).
 * Attaches { userId, email, role } to req.user.
 */
export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  let token: string | undefined;

  // 1. Check Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    token = authHeader.slice(7);
  }

  // 2. Fall back to httpOnly cookie
  if (!token && req.cookies?.vintus_token) {
    token = req.cookies.vintus_token as string;
  }

  if (!token) {
    res.status(401).json({ success: false, error: "Authentication required" });
    return;
  }

  try {
    const payload = await verifyToken(token);

    if (!payload) {
      res.status(401).json({ success: false, error: "Invalid or expired token" });
      return;
    }

    req.user = {
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
    };

    next();
  } catch (err) {
    logger.warn({ err }, "Auth middleware error");
    res.status(401).json({ success: false, error: "Invalid or expired token" });
  }
}
