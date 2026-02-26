import type { Request, Response, NextFunction } from "express";
import { logger } from "../lib/logger.js";

/**
 * Global Express error handler.
 * Catches all unhandled errors, logs them, and returns a consistent JSON response.
 */
export function errorHandler(
  err: Error & { statusCode?: number; code?: string },
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = err.statusCode ?? 500;
  const message =
    statusCode === 500 ? "Internal server error" : err.message;

  logger.error(
    {
      err,
      statusCode,
      code: err.code,
      stack: err.stack,
    },
    `Error: ${err.message}`
  );

  res.status(statusCode).json({
    success: false,
    error: message,
  });
}
