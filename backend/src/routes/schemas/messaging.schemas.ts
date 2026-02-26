import { z } from "zod";

export const sendMessageSchema = z.object({
  userId: z.string().min(1, "userId is required"),
  category: z.enum([
    "WELCOME",
    "MOTIVATION",
    "HUMOR",
    "EDUCATION",
    "ACCOUNTABILITY",
    "RECOVERY_TIP",
    "WORKOUT_COMPLETED",
    "WORKOUT_MISSED",
    "ESCALATION",
    "CHECK_IN",
    "SYSTEM",
  ]),
  channel: z.enum(["SMS", "EMAIL"]),
  context: z.record(z.unknown()).optional(),
});

export type SendMessage = z.infer<typeof sendMessageSchema>;
