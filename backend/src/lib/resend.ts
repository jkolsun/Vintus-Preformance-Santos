import { Resend } from "resend";
import { env } from "../config/env.js";
import { logger } from "./logger.js";

const resendClient = new Resend(env.RESEND_API_KEY);

const RESEND_FROM_EMAIL = env.RESEND_FROM_EMAIL;

/**
 * Wrap message content in the branded Vintus email template.
 * Dark theme matching the booking confirmation style.
 */
function buildBrandedHTML(content: string, subject: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f5;padding:40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#0a0a0a;border-radius:16px;box-shadow:0 4px 20px rgba(0,0,0,0.25);max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="padding:40px 40px 20px;border-bottom:1px solid #222222;text-align:center;">
              <img src="https://vintusperformance.org/images/Vintus_LOGO.PNG" alt="Vintus Performance" style="max-width:180px;height:auto;">
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding:30px 40px;">
              <div style="background-color:#141414;border-left:4px solid #c0c0c0;border-radius:0 8px 8px 0;padding:25px;">
                <p style="color:#e5e5e5;font-size:16px;line-height:1.6;margin:0;">
                  ${content}
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px 30px;border-top:1px solid #222222;">
              <p style="color:#666666;font-size:12px;text-align:center;margin:0 0 10px;">
                Discipline Within. Dominance Beyond.
              </p>
              <p style="color:#444444;font-size:11px;text-align:center;margin:0;">
                Vintus Performance &mdash; Premium Adaptive Coaching
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Send a branded email via Resend.
 * Returns the message ID on success, or null on failure.
 */
export async function sendEmail(
  to: string,
  subject: string,
  textContent: string
): Promise<string | null> {
  try {
    const html = buildBrandedHTML(textContent, subject);

    const result = await resendClient.emails.send({
      from: RESEND_FROM_EMAIL,
      to,
      subject,
      html,
      text: textContent,
    });

    const messageId = result.data?.id ?? null;

    logger.info(
      { messageId, to, subject },
      "Email sent successfully"
    );

    return messageId;
  } catch (err) {
    const error = err as Error & { statusCode?: number };

    if (error.statusCode === 429) {
      logger.warn({ to, subject }, "Email failed: Resend rate limit hit");
    } else if (error.statusCode === 422) {
      logger.warn({ to, subject }, "Email failed: invalid recipient address");
    } else {
      logger.error({ err, to, subject }, "Email sending failed");
    }

    return null;
  }
}
