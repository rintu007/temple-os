import type { DomainError } from './errors';

/**
 * Services return Result instead of throwing for expected failures.
 * Adapters (Server Actions, API routes) map the error to UI/HTTP.
 */
export type Result<T, E extends DomainError = DomainError> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export function ok<T>(value: T): { ok: true; value: T } {
  return { ok: true, value };
}

export function err<E extends DomainError>(error: E): { ok: false; error: E } {
  return { ok: false, error };
}

export function unwrap<T, E extends DomainError>(result: Result<T, E>): T {
  if (!result.ok) {
    throw new Error(`unwrap() on error result: ${result.error.code} — ${result.error.message}`);
  }
  return result.value;
}
