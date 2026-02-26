import { z } from "zod";

export const createCheckoutSchema = z.object({
  tier: z.enum([
    "PRIVATE_COACHING",
    "TRAINING_30DAY",
    "TRAINING_60DAY",
    "TRAINING_90DAY",
    "NUTRITION_4WEEK",
    "NUTRITION_8WEEK",
  ]),
  successUrl: z.string().url("successUrl must be a valid URL"),
  cancelUrl: z.string().url("cancelUrl must be a valid URL"),
  profileId: z.string().min(1).optional(),
});

export type CreateCheckout = z.infer<typeof createCheckoutSchema>;
