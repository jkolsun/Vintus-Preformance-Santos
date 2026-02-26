import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url("DATABASE_URL must be a valid connection string"),

  // Application
  FRONTEND_URL: z.string().url("FRONTEND_URL must be a valid URL"),
  PORT: z.coerce.number().int().positive().default(4000),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),

  // Auth
  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 characters"),
  JWT_EXPIRES_IN: z.string().default("7d"),

  // Stripe
  STRIPE_SECRET_KEY: z.string().startsWith("sk_", "STRIPE_SECRET_KEY must start with sk_"),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith("whsec_", "STRIPE_WEBHOOK_SECRET must start with whsec_"),
  STRIPE_PRICE_PRIVATE_COACHING: z.string().startsWith("price_", "STRIPE_PRICE_PRIVATE_COACHING must be a Stripe Price ID"),
  STRIPE_PRICE_TRAINING_30DAY: z.string().startsWith("price_", "STRIPE_PRICE_TRAINING_30DAY must be a Stripe Price ID"),
  STRIPE_PRICE_TRAINING_60DAY: z.string().startsWith("price_", "STRIPE_PRICE_TRAINING_60DAY must be a Stripe Price ID"),
  STRIPE_PRICE_TRAINING_90DAY: z.string().startsWith("price_", "STRIPE_PRICE_TRAINING_90DAY must be a Stripe Price ID"),
  STRIPE_PRICE_NUTRITION_4WEEK: z.string().startsWith("price_", "STRIPE_PRICE_NUTRITION_4WEEK must be a Stripe Price ID"),
  STRIPE_PRICE_NUTRITION_8WEEK: z.string().startsWith("price_", "STRIPE_PRICE_NUTRITION_8WEEK must be a Stripe Price ID"),

  // Twilio
  TWILIO_ACCOUNT_SID: z.string().startsWith("AC", "TWILIO_ACCOUNT_SID must start with AC"),
  TWILIO_AUTH_TOKEN: z.string().min(1, "TWILIO_AUTH_TOKEN is required"),
  TWILIO_PHONE_NUMBER: z.string().min(1, "TWILIO_PHONE_NUMBER is required"),

  // Resend
  RESEND_API_KEY: z.string().startsWith("re_", "RESEND_API_KEY must start with re_"),
  RESEND_FROM_EMAIL: z.string().email("RESEND_FROM_EMAIL must be a valid email"),

  // Anthropic
  ANTHROPIC_API_KEY: z.string().min(1, "ANTHROPIC_API_KEY is required"),

  // Encryption
  ENCRYPTION_KEY: z.string().min(32, "ENCRYPTION_KEY must be at least 32 characters"),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error("❌ Invalid environment variables:");
    for (const issue of result.error.issues) {
      console.error(`  → ${issue.path.join(".")}: ${issue.message}`);
    }
    process.exit(1);
  }

  return result.data;
}

export const env = loadEnv();
