import dotenv from 'dotenv';
import { resolve } from 'node:path';
import { z } from 'zod';
dotenv.config({
  path: [resolve(process.cwd(), '.env'), resolve(process.cwd(), '../../.env')],
  quiet: true,
});
const schema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_CHAT_ID: z.string().optional(),
});
const result = schema.safeParse(process.env);
if (!result.success)
  throw new Error(
    `Invalid environment variables: ${result.error.issues.map((i) => i.path.join('.')).join(', ')}`,
  );
export const env = result.data;
