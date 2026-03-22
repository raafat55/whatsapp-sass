import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const schema = z.object({
  MONGO_URI: z.string().min(1),
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  JWT_SECRET: z.string().min(16),
  ENCRYPTION_KEY: z.string().length(64).regex(/^[0-9a-fA-F]+$/),
  AI_REPLY_MAX_PER_MINUTE: z.coerce.number().min(1).default(30),
  AI_MEMORY_MAX_MESSAGES: z.coerce.number().min(1).max(100).default(30),
});

export type AppConfig = z.infer<typeof schema>;

let cached: AppConfig | null = null;

export function getConfig(): AppConfig {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Invalid environment: ${parsed.error.message}`);
  }
  cached = parsed.data;
  return cached;
}
