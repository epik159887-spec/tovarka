import { defineConfig } from 'prisma/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { env } from './src/config/env.js';
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  experimental: { adapter: true },
  engine: 'js',
  adapter: async () => new PrismaPg({ connectionString: env.DATABASE_URL }),
});
