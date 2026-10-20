import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { env } from '../config/env.js';
import { describeMigrationError } from './errors.js';

// Apply versioned, Prisma-generated SQL without downloading a native CLI engine.
// This ledger is intentionally separate from Prisma Migrate's internal tables.
const directory = fileURLToPath(
  new URL('../../prisma/migrations/', import.meta.url),
);
const client = new pg.Client({
  connectionString: env.DATABASE_URL,
  connectionTimeoutMillis: 10000,
});
let connected = false;
let stage = 'connecting to PostgreSQL';
try {
  await client.connect();
  connected = true;
  stage = 'initializing the migration ledger';
  await client.query('SELECT pg_advisory_lock($1)', [847159887]);
  await client.query(`CREATE TABLE IF NOT EXISTS "_tovarka_migrations" (
    name TEXT PRIMARY KEY, checksum TEXT NOT NULL, applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);
  stage = 'reading migration files';
  const directories = (await readdir(directory, { withFileTypes: true }))
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
  for (const name of directories) {
    stage = `checking migration ${name}`;
    const sql = await readFile(`${directory}${name}/migration.sql`, 'utf8');
    const checksum = createHash('sha256').update(sql).digest('hex');
    const existing = await client.query<{ checksum: string }>(
      'SELECT checksum FROM "_tovarka_migrations" WHERE name = $1',
      [name],
    );
    if (existing.rowCount) {
      if (existing.rows[0]?.checksum !== checksum)
        throw Object.assign(new Error('Applied migration was modified'), {
          code: 'MIGRATION_CHANGED',
        });
      console.log(`Already applied: ${name}`);
      continue;
    }
    stage = `applying migration ${name}`;
    await client.query('BEGIN');
    try {
      await client.query(sql);
      await client.query(
        'INSERT INTO "_tovarka_migrations" (name, checksum) VALUES ($1, $2)',
        [name, checksum],
      );
      await client.query('COMMIT');
      console.log(`Applied: ${name}`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  }
} catch (error) {
  console.error('Migration failed', {
    stage,
    ...describeMigrationError(error),
  });
  process.exitCode = 1;
} finally {
  if (connected)
    await client
      .query('SELECT pg_advisory_unlock($1)', [847159887])
      .catch(() => undefined);
  await client.end();
}
