import { prisma } from "../lib/prisma.js";
import { logger } from "../lib/logger.js";
import { sendEmail } from "../lib/resend.js";
import { env } from "../config/env.js";
import type { ContactInput, ConsultationInput } from "../routes/schemas/leads.schemas.js";

/** Save a contact form submission and email admin */
export async function createContactLead(data: ContactInput) {
  const lead = await prisma.lead.create({
    data: {
      type: "CONTACT",
      firstName: data.firstName,
      lastName: data.lastName ?? null,
      email: data.email,
      phone: data.phone ?? null,
      interest: data.interest ?? null,
      goals: data.goals ?? null,
      referral: data.referral ?? null,
    },
  });

  logger.info({ leadId: lead.id, email: data.email }, "Contact lead created");

  // Email admin notification (fire and forget)
  const adminBody = [
    `New contact form submission from <strong>${data.firstName}${data.lastName ? " " + data.lastName : ""}</strong>.`,
    `<br><br><strong>Email:</strong> ${data.email}`,
    data.phone ? `<br><strong>Phone:</strong> ${data.phone}` : "",
    data.interest ? `<br><strong>Interest:</strong> ${data.interest}` : "",
    data.goals ? `<br><strong>Goals:</strong> ${data.goals}` : "",
    data.referral ? `<br><strong>Referral:</strong> ${data.referral}` : "",
  ].join("");

  sendEmail(
    env.RESEND_FROM_EMAIL,
    `New Contact Form — ${data.firstName}`,
    adminBody
  ).catch((err) => logger.error({ err }, "Failed to send contact admin email"));

  return lead;
}

/** Save a consultation booking request, email admin + client confirmation */
export async function createConsultationLead(data: ConsultationInput) {
  const lead = await prisma.lead.create({
    data: {
      type: "CONSULTATION",
      firstName: data.firstName,
      lastName: data.lastName ?? null,
      email: data.email,
      phone: data.phone ?? null,
      preferredDate: data.preferredDate,
      preferredTime: data.preferredTime,
      tier: data.tier ?? null,
      primaryGoal: data.primaryGoal ?? null,
      experience: data.experience ?? null,
      notes: data.notes ?? null,
    },
  });

  logger.info({ leadId: lead.id, email: data.email }, "Consultation lead created");

  // Admin notification
  const adminBody = [
    `New consultation request from <strong>${data.firstName}${data.lastName ? " " + data.lastName : ""}</strong>.`,
    `<br><br><strong>Email:</strong> ${data.email}`,
    data.phone ? `<br><strong>Phone:</strong> ${data.phone}` : "",
    `<br><strong>Preferred Date:</strong> ${data.preferredDate}`,
    `<br><strong>Preferred Time:</strong> ${data.preferredTime}`,
    data.tier ? `<br><strong>Plan Interest:</strong> ${data.tier}` : "",
    data.primaryGoal ? `<br><strong>Goal:</strong> ${data.primaryGoal}` : "",
    data.experience ? `<br><strong>Experience:</strong> ${data.experience}` : "",
    data.notes ? `<br><strong>Notes:</strong> ${data.notes}` : "",
  ].join("");

  sendEmail(
    env.RESEND_FROM_EMAIL,
    `New Consultation Request — ${data.firstName}`,
    adminBody
  ).catch((err) => logger.error({ err }, "Failed to send consultation admin email"));

  // Client confirmation
  const clientBody = [
    `Hi ${data.firstName},`,
    `<br><br>We've received your consultation request for <strong>${data.preferredDate}</strong> at <strong>${data.preferredTime}</strong>.`,
    `<br><br>Our team will confirm your appointment within 24 hours. If you need to make changes, reply to this email or contact us directly.`,
    `<br><br>Looking forward to helping you reach your goals!`,
  ].join("");

  sendEmail(
    data.email,
    "Your Vintus Performance Consultation Request",
    clientBody
  ).catch((err) => logger.error({ err }, "Failed to send client confirmation email"));

  return lead;
}

/** Return available consultation slots for a given month */
export async function getAvailableSlots(month: number, year: number) {
  // Get confirmed consultation leads for this period to exclude those slots
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endMonth = month === 12 ? 1 : month + 1;
  const endYear = month === 12 ? year + 1 : year;
  const endDate = `${endYear}-${String(endMonth).padStart(2, "0")}-01`;

  const confirmedLeads = await prisma.lead.findMany({
    where: {
      type: "CONSULTATION",
      status: { in: ["NEW", "CONFIRMED"] },
      preferredDate: {
        gte: startDate,
        lt: endDate,
      },
    },
    select: {
      preferredDate: true,
      preferredTime: true,
    },
  });

  // Build set of booked slots
  const bookedSlots: Record<string, string[]> = {};
  for (const lead of confirmedLeads) {
    if (lead.preferredDate && lead.preferredTime) {
      if (!bookedSlots[lead.preferredDate]) {
        bookedSlots[lead.preferredDate] = [];
      }
      bookedSlots[lead.preferredDate].push(lead.preferredTime);
    }
  }

  return { bookedSlots };
}
