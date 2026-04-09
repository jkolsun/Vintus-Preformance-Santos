import nodemailer from "nodemailer";
import { logger } from "./logger.js";

/**
 * Gmail SMTP notification service.
 * Uses Gmail App Password (requires 2FA on the Gmail account).
 *
 * Required env vars:
 *   GMAIL_USER        — your Gmail address (e.g., coach@gmail.com)
 *   GMAIL_APP_PASSWORD — 16-char app password from Google Account → Security → App passwords
 *   ADMIN_NOTIFY_EMAIL — where admin notifications go (can be same as GMAIL_USER)
 */

const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;
const ADMIN_NOTIFY_EMAIL = process.env.ADMIN_NOTIFY_EMAIL || GMAIL_USER;

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    logger.warn("Gmail SMTP not configured (GMAIL_USER / GMAIL_APP_PASSWORD missing)");
    return null;
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: GMAIL_USER,
        pass: GMAIL_APP_PASSWORD,
      },
    });
  }

  return transporter;
}

/**
 * Send an admin notification email via Gmail SMTP.
 */
export async function notifyAdmin(
  subject: string,
  body: string
): Promise<void> {
  const t = getTransporter();
  if (!t || !ADMIN_NOTIFY_EMAIL) {
    logger.info({ subject }, "Admin notification skipped (Gmail not configured)");
    return;
  }

  try {
    await t.sendMail({
      from: `"Vintus Performance" <${GMAIL_USER}>`,
      to: ADMIN_NOTIFY_EMAIL,
      subject,
      html: body,
    });
    logger.info({ subject, to: ADMIN_NOTIFY_EMAIL }, "Admin notification email sent");
  } catch (err) {
    logger.error({ err, subject }, "Failed to send admin notification email");
  }
}

/**
 * Send a password reset email to a client.
 */
export async function sendPasswordResetEmail(
  to: string,
  resetLink: string
): Promise<void> {
  const t = getTransporter();
  if (!t) {
    logger.info({ to }, "Password reset email skipped (Gmail not configured)");
    return;
  }

  const subject = "Reset Your Vintus Performance Password";
  const body = `
    <div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:20px;background:#0a0a0a;color:#e5e5e5;border-radius:8px;">
      <h2 style="color:#fff;margin-bottom:20px;">Password Reset Request</h2>
      <p style="color:#a3a3a3;line-height:1.6;">
        We received a request to reset the password for your Vintus Performance account.
        Click the button below to set a new password. This link expires in 1 hour.
      </p>
      <div style="text-align:center;margin:30px 0;">
        <a href="${resetLink}" style="display:inline-block;padding:12px 32px;background:#fff;color:#0a0a0a;text-decoration:none;font-weight:700;border-radius:6px;font-size:16px;">
          Reset Password
        </a>
      </div>
      <p style="color:#737373;font-size:13px;line-height:1.5;">
        If you didn't request this, you can safely ignore this email. Your password will remain unchanged.
      </p>
      <hr style="border:none;border-top:1px solid #262626;margin:20px 0;" />
      <p style="color:#525252;font-size:12px;">Vintus Performance</p>
    </div>
  `;

  try {
    await t.sendMail({
      from: `"Vintus Performance" <${GMAIL_USER}>`,
      to,
      subject,
      html: body,
    });
    logger.info({ to }, "Password reset email sent");
  } catch (err) {
    logger.error({ err, to }, "Failed to send password reset email");
    throw err;
  }
}

/**
 * Notify admin of a new client signup.
 */
export async function notifyNewClient(data: {
  name: string;
  email: string;
  planTier: string;
  status: string;
}): Promise<void> {
  const tierDisplay: Record<string, string> = {
    PRIVATE_COACHING: "Private Coaching",
    TRAINING_30DAY: "30-Day Training",
    TRAINING_60DAY: "60-Day Training",
    TRAINING_90DAY: "90-Day Training",
    NUTRITION_4WEEK: "4-Week Nutrition",
    NUTRITION_8WEEK: "8-Week Nutrition",
  };

  const tier = tierDisplay[data.planTier] || data.planTier;
  const needsApproval = data.status === "PENDING_APPROVAL";

  const subject = needsApproval
    ? `🔔 New Client Needs Approval: ${data.name}`
    : `✅ New Client Activated: ${data.name}`;

  const body = `
    <div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:20px;">
      <h2 style="color:#333;margin-bottom:20px;">${needsApproval ? "New Client — Approval Required" : "New Client — Auto-Activated"}</h2>
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="padding:8px 0;color:#666;width:120px;">Name</td><td style="padding:8px 0;font-weight:600;">${data.name}</td></tr>
        <tr><td style="padding:8px 0;color:#666;">Email</td><td style="padding:8px 0;">${data.email}</td></tr>
        <tr><td style="padding:8px 0;color:#666;">Plan</td><td style="padding:8px 0;">${tier}</td></tr>
        <tr><td style="padding:8px 0;color:#666;">Status</td><td style="padding:8px 0;color:${needsApproval ? "#f59e0b" : "#22c55e"};font-weight:600;">${needsApproval ? "Pending Approval" : "Active"}</td></tr>
      </table>
      ${needsApproval ? '<p style="margin-top:20px;color:#666;">Log into the <a href="' + (process.env.FRONTEND_URL || "") + '/admin.html" style="color:#333;font-weight:600;">Admin Dashboard</a> to review and approve this client.</p>' : ""}
    </div>
  `;

  await notifyAdmin(subject, body);
}

/**
 * Notify admin when a new lead completes the assessment form.
 * Fires BEFORE checkout — captures lead info even if they don't pay.
 */
export async function notifyNewLead(data: {
  name: string;
  email: string;
  phone: string | null;
  primaryGoal: string;
  experienceLevel: string;
  persona: string | null;
}): Promise<void> {
  const goalDisplay: Record<string, string> = {
    "build-muscle": "Build Muscle",
    "lose-fat": "Lose Fat",
    "endurance": "Endurance",
    "recomposition": "Recomposition",
    "well-rounded": "Well-Rounded Fitness",
  };

  const expDisplay: Record<string, string> = {
    "beginner": "Beginner",
    "intermediate": "Intermediate",
    "advanced": "Advanced",
    "elite": "Elite",
  };

  const subject = `New Lead: ${data.name} — ${goalDisplay[data.primaryGoal] || data.primaryGoal}`;

  const body = `
    <div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:20px;">
      <h2 style="color:#333;margin-bottom:20px;">New Assessment Completed</h2>
      <p style="color:#666;margin-bottom:16px;">A potential client just completed the assessment form. They have NOT paid yet — follow up if they don't convert.</p>
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="padding:8px 0;color:#666;width:120px;">Name</td><td style="padding:8px 0;font-weight:600;">${data.name}</td></tr>
        <tr><td style="padding:8px 0;color:#666;">Email</td><td style="padding:8px 0;"><a href="mailto:${data.email}" style="color:#2563eb;">${data.email}</a></td></tr>
        ${data.phone ? `<tr><td style="padding:8px 0;color:#666;">Phone</td><td style="padding:8px 0;"><a href="tel:${data.phone}" style="color:#2563eb;">${data.phone}</a></td></tr>` : ""}
        <tr><td style="padding:8px 0;color:#666;">Goal</td><td style="padding:8px 0;">${goalDisplay[data.primaryGoal] || data.primaryGoal}</td></tr>
        <tr><td style="padding:8px 0;color:#666;">Experience</td><td style="padding:8px 0;">${expDisplay[data.experienceLevel] || data.experienceLevel}</td></tr>
        ${data.persona ? `<tr><td style="padding:8px 0;color:#666;">AI Persona</td><td style="padding:8px 0;font-style:italic;">${data.persona}</td></tr>` : ""}
      </table>
      <p style="margin-top:20px;padding:12px;background:#fef3c7;border-radius:6px;color:#92400e;font-size:14px;">
        This lead has NOT purchased yet. If they don't check out within 24 hours, consider reaching out directly.
      </p>
    </div>
  `;

  await notifyAdmin(subject, body);
}
