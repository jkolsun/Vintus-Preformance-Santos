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
