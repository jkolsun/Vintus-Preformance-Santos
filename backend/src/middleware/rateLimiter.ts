import rateLimit from "express-rate-limit";

/**
 * Rate limiters for sensitive endpoints.
 * Applied per-route (not globally) to avoid penalizing normal traffic.
 */

/** POST /auth/login — 10 attempts per 15 min per IP */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Too many login attempts. Please try again in 15 minutes." },
});

/** POST /auth/forgot-password — 5 attempts per 15 min per IP */
export const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Too many password reset requests. Please try again in 15 minutes." },
});

/** POST /chat/send — 30 per 5 min per IP (user-scoped via auth, but IP as fallback) */
export const chatSendLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Too many messages. Please slow down and try again shortly." },
});

/** POST /intake/full — 10 per 15 min per IP */
export const intakeFullLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Too many submissions. Please try again in 15 minutes." },
});
