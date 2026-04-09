import jwt, { type SignOptions, type Secret } from "jsonwebtoken";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import type { Role } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";
import { sendPasswordResetEmail } from "../lib/gmail-notify.js";

const SALT_ROUNDS = 12;

interface TokenPayload {
  userId: string;
  email: string;
  role: Role;
}

function signToken(payload: TokenPayload): string {
  const secret: Secret = env.JWT_SECRET;
  const options: SignOptions = { expiresIn: env.JWT_EXPIRES_IN as unknown as SignOptions["expiresIn"] };
  return jwt.sign(payload, secret, options);
}

function getTokenExpiry(): Date {
  // Parse JWT_EXPIRES_IN (e.g. "7d", "24h") into a Date
  const match = env.JWT_EXPIRES_IN.match(/^(\d+)([dhms])$/);
  const now = Date.now();
  if (!match) return new Date(now + 7 * 24 * 60 * 60 * 1000); // default 7d

  const value = parseInt(match[1], 10);
  const unit = match[2];
  const multipliers: Record<string, number> = {
    d: 24 * 60 * 60 * 1000,
    h: 60 * 60 * 1000,
    m: 60 * 1000,
    s: 1000,
  };
  return new Date(now + value * (multipliers[unit] ?? 0));
}

/** Register a new user with email + password, create AthleteProfile shell.
 *  If the user was already created via intake (temp password, no sessions),
 *  claim the account by setting the real password instead of throwing 409.
 */
export async function register(
  email: string,
  password: string,
  firstName: string,
  lastName: string
): Promise<{ token: string; userId: string }> {
  const existing = await prisma.user.findUnique({
    where: { email },
    include: { sessions: { take: 1 }, athleteProfile: true },
  });

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  if (existing) {
    // If the user has active sessions, they already registered — reject duplicate
    if (existing.sessions.length > 0) {
      const err = new Error("A user with this email already exists") as Error & { statusCode?: number };
      err.statusCode = 409;
      throw err;
    }

    // Intake-created user (temp password, no sessions) — claim the account
    await prisma.user.update({
      where: { id: existing.id },
      data: { passwordHash },
    });

    // Ensure AthleteProfile exists (intake should have created it, but guard)
    if (!existing.athleteProfile) {
      await prisma.athleteProfile.create({
        data: {
          userId: existing.id,
          firstName,
          lastName,
          primaryGoal: "well-rounded",
          secondaryGoals: [],
          trainingDaysPerWeek: 3,
          experienceLevel: "beginner",
          equipmentAccess: "full-gym",
          riskFlags: [],
          recoveryPractices: [],
        },
      });
    }

    const token = signToken({ userId: existing.id, email: existing.email, role: existing.role });

    await prisma.session.create({
      data: {
        userId: existing.id,
        token,
        expiresAt: getTokenExpiry(),
      },
    });

    logger.info({ userId: existing.id, email }, "Intake user claimed account via register");

    return { token, userId: existing.id };
  }

  // Brand-new user — create User + AthleteProfile shell
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      role: "CLIENT",
      athleteProfile: {
        create: {
          firstName,
          lastName,
          primaryGoal: "well-rounded",
          secondaryGoals: [],
          trainingDaysPerWeek: 3,
          experienceLevel: "beginner",
          equipmentAccess: "full-gym",
          riskFlags: [],
          recoveryPractices: [],
        },
      },
    },
  });

  const token = signToken({ userId: user.id, email: user.email, role: user.role });

  await prisma.session.create({
    data: {
      userId: user.id,
      token,
      expiresAt: getTokenExpiry(),
    },
  });

  logger.info({ userId: user.id, email }, "User registered");

  return { token, userId: user.id };
}

/** Login with email + password, create Session record, return JWT */
export async function login(
  email: string,
  password: string
): Promise<{ token: string; userId: string; role: Role }> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    const err = new Error("Invalid email or password") as Error & { statusCode?: number };
    err.statusCode = 401;
    throw err;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    const err = new Error("Invalid email or password") as Error & { statusCode?: number };
    err.statusCode = 401;
    throw err;
  }

  const token = signToken({ userId: user.id, email: user.email, role: user.role });

  // Create Session record
  await prisma.session.create({
    data: {
      userId: user.id,
      token,
      expiresAt: getTokenExpiry(),
    },
  });

  logger.info({ userId: user.id, email }, "User logged in");

  return { token, userId: user.id, role: user.role };
}

/** Logout — delete Session record by token */
export async function logout(token: string): Promise<void> {
  await prisma.session.deleteMany({ where: { token } });
  logger.info("Session deleted (logout)");
}

/** Verify a JWT token and check Session exists in DB */
export async function verifyToken(
  token: string
): Promise<{ userId: string; email: string; role: Role } | null> {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as TokenPayload;

    // Verify session exists and is not expired
    const session = await prisma.session.findUnique({ where: { token } });
    if (!session || session.expiresAt < new Date()) {
      return null;
    }

    return { userId: decoded.userId, email: decoded.email, role: decoded.role };
  } catch {
    return null;
  }
}

/** Change password for authenticated user */
export async function changePassword(
  userId: string,
  oldPassword: string,
  newPassword: string
): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    const err = new Error("User not found") as Error & { statusCode?: number };
    err.statusCode = 404;
    throw err;
  }

  const valid = await bcrypt.compare(oldPassword, user.passwordHash);
  if (!valid) {
    const err = new Error("Current password is incorrect") as Error & { statusCode?: number };
    err.statusCode = 401;
    throw err;
  }

  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
  });

  // Invalidate all existing sessions (force re-login)
  await prisma.session.deleteMany({ where: { userId } });

  logger.info({ userId }, "Password changed, all sessions invalidated");
}

const RESET_TOKEN_PREFIX = "reset_";
const RESET_TOKEN_EXPIRY_MS = 60 * 60 * 1000; // 1 hour

/** Request a password reset — generates token, stores in Session, sends email */
export async function requestPasswordReset(email: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email } });

  // Always return success to avoid leaking whether an email exists
  if (!user) {
    logger.info({ email }, "Password reset requested for non-existent email");
    return;
  }

  // Invalidate any existing reset tokens for this user
  await prisma.session.deleteMany({
    where: {
      userId: user.id,
      token: { startsWith: RESET_TOKEN_PREFIX },
    },
  });

  // Generate a secure reset token
  const rawToken = crypto.randomBytes(32).toString("hex");
  const token = `${RESET_TOKEN_PREFIX}${rawToken}`;

  // Store as a Session record with 1-hour expiry
  await prisma.session.create({
    data: {
      userId: user.id,
      token,
      expiresAt: new Date(Date.now() + RESET_TOKEN_EXPIRY_MS),
    },
  });

  // Build reset link and send email
  const resetLink = `${env.FRONTEND_URL}/reset-password.html?token=${rawToken}`;
  await sendPasswordResetEmail(user.email, resetLink);

  logger.info({ userId: user.id, email }, "Password reset token created and email sent");
}

/** Reset password using a valid reset token */
export async function resetPassword(
  token: string,
  newPassword: string
): Promise<void> {
  const fullToken = `${RESET_TOKEN_PREFIX}${token}`;

  const session = await prisma.session.findUnique({
    where: { token: fullToken },
  });

  if (!session) {
    const err = new Error("Invalid or expired reset token") as Error & { statusCode?: number };
    err.statusCode = 400;
    throw err;
  }

  if (session.expiresAt < new Date()) {
    // Clean up expired token
    await prisma.session.delete({ where: { id: session.id } });
    const err = new Error("Reset token has expired") as Error & { statusCode?: number };
    err.statusCode = 400;
    throw err;
  }

  // Hash the new password and update user
  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await prisma.user.update({
    where: { id: session.userId },
    data: { passwordHash },
  });

  // Delete the reset token
  await prisma.session.delete({ where: { id: session.id } });

  // Invalidate all existing login sessions (force re-login)
  await prisma.session.deleteMany({ where: { userId: session.userId } });

  logger.info({ userId: session.userId }, "Password reset successfully, all sessions invalidated");
}
