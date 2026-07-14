import { describe, expect, it } from 'vitest';
import { domainError } from './errors';
import { err, ok, unwrap } from './result';

describe('Result', () => {
  it('ok carries the value', () => {
    const r = ok(42);
    expect(r.ok).toBe(true);
    expect(unwrap(r)).toBe(42);
  });

  it('err carries a domain error', () => {
    const r = err(domainError('CONFLICT', 'slug taken', { field: 'slug' }));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe('CONFLICT');
      expect(r.error.details).toEqual({ field: 'slug' });
    }
  });

  it('unwrap throws on error results', () => {
    expect(() => unwrap(err(domainError('NOT_FOUND', 'missing')))).toThrow(/NOT_FOUND/);
  });
});
