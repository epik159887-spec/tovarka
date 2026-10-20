import { describe, expect, it } from 'vitest';
import { describeMigrationError } from '../apps/backend/src/utils/errors.js';

describe('safe migration diagnostics', () => {
  it.each(['28P01', 'ECONNREFUSED', '3D000', 'MIGRATION_CHANGED'])(
    'explains %s without exposing the original message',
    (code) => {
      const result = describeMigrationError(
        Object.assign(
          new Error('postgresql://user:private-password@host/database'),
          { code },
        ),
      );
      expect(result.code).toBe(code);
      expect(result.hint.length).toBeGreaterThan(20);
      expect(JSON.stringify(result)).not.toContain('private-password');
    },
  );
  it('recognizes nested Windows/Node connection errors', () => {
    const error = new AggregateError([
      Object.assign(new Error('private details'), { code: 'ECONNREFUSED' }),
    ]);
    expect(describeMigrationError(error).code).toBe('ECONNREFUSED');
  });
  it('does not reveal unknown errors or recurse forever', () => {
    const error = {
      code: 'private-password',
      message: 'private-password',
      cause: {},
    };
    error.cause = error;
    const result = describeMigrationError(error);
    expect(result.code).toBe('MIGRATION_ERROR');
    expect(JSON.stringify(result)).not.toContain('private-password');
  });
});
