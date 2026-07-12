import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  SESSION_SECRET: z.string().min(32),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  STRIPE_SECRET_KEY: z.string().optional(),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("SureBook <onboarding@resend.dev>"),
  CRON_SECRET: z.string().optional(),
  PLATFORM_FEE_PERCENT: z.coerce.number().min(0).max(50).default(5),
  DEFAULT_DEPOSIT_CENTS: z.coerce.number().int().min(0).default(1000),
  WA_PHONE_ID: z.string().optional(),
  WA_TOKEN: z.string().optional(),
});

export const env = schema.parse(process.env);
