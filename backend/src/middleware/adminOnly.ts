import type { Request, Response, NextFunction } from "express";

/**
 * Middleware that checks if the authenticated user has the ADMIN role.
 * Must be used AFTER the authenticate middleware.
 */
export function adminOnly(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    res.status(401).json({ success: false, error: "Authentication required" });
    return;
  }

  if (req.user.role !== "ADMIN") {
    res
      .status(403)
      .json({ success: false, error: "Admin access required" });
    return;
  }

  next();
}
