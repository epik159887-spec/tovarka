export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

const migrationHints: Record<string, string> = {
  ECONNREFUSED:
    'PostgreSQL is not accepting connections. Run docker compose up -d --wait postgres and check the port in DATABASE_URL.',
  ETIMEDOUT:
    'The database connection timed out. Check PostgreSQL availability and the host and port in DATABASE_URL.',
  ENOTFOUND:
    'The database hostname could not be resolved. Check the host in DATABASE_URL.',
  '28P01':
    'PostgreSQL rejected the password. Match DATABASE_URL to the credentials used when the database volume was initialized.',
  '28000':
    'PostgreSQL rejected authentication. Check the database user and authentication configuration.',
  '3D000':
    'The configured database does not exist. Check the database name in DATABASE_URL.',
  '42501': 'The database user lacks permission to apply migrations.',
  '42P07':
    'A migration tried to create an existing table. Check the migration ledger and database before changing any data.',
  ENOENT:
    'A migration file or directory is missing. Run the command from a complete checkout.',
  MIGRATION_CHANGED:
    'An applied migration has changed. Restore its original contents and add a new migration for further changes.',
};

export function describeMigrationError(
  error: unknown,
  depth = 0,
): { code: string; hint: string } {
  if (depth < 3 && typeof error === 'object' && error !== null) {
    if (
      'code' in error &&
      typeof error.code === 'string' &&
      Object.hasOwn(migrationHints, error.code)
    ) {
      return { code: error.code, hint: migrationHints[error.code]! };
    }
    if ('errors' in error && Array.isArray(error.errors)) {
      for (const nested of error.errors) {
        const result = describeMigrationError(nested, depth + 1);
        if (result.code !== 'MIGRATION_ERROR') return result;
      }
    }
    if ('cause' in error) return describeMigrationError(error.cause, depth + 1);
  }
  // Raw error messages can contain connection credentials or SQL data.
  return {
    code: 'MIGRATION_ERROR',
    hint: 'Check the reported migration stage, PostgreSQL status, and server logs. Do not share DATABASE_URL or credentials.',
  };
}
