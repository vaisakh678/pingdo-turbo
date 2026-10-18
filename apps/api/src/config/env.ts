import { z } from "zod";

try {
  process.loadEnvFile();
} catch {
  // .env not found — fine if required vars are already in process.env.
}

const envSchema = z.object({
  DATABASE_URL: z.string().url(),

  // Optional overrides for the platform/region labels; see lib/server-info.
  PLATFORM: z.string().optional(),
  REGION: z.string().optional(),

  LOG_LEVEL: z
    .enum(["trace", "debug", "info", "warn", "error", "fatal", "silent"])
    .default("info"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment variables:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
