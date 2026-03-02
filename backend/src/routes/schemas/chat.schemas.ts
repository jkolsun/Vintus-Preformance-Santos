import { z } from "zod";

export const sendChatMessageSchema = z.object({
  message: z.string().min(1, "Message cannot be empty").max(500, "Message must be 500 characters or fewer"),
});

export type SendChatMessageInput = z.infer<typeof sendChatMessageSchema>;
