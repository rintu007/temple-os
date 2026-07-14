export type DomainErrorCode =
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'FORBIDDEN'
  | 'UNAUTHENTICATED'
  | 'VALIDATION'
  | 'PAYMENT_FAILED'
  | 'INTERNAL';

export interface DomainError {
  readonly code: DomainErrorCode;
  readonly message: string;
  readonly details?: Record<string, unknown>;
}

export function domainError(
  code: DomainErrorCode,
  message: string,
  details?: Record<string, unknown>,
): DomainError {
  return { code, message, details };
}

export const notFound = (entity: string): DomainError =>
  domainError('NOT_FOUND', `${entity} not found`);

export const conflict = (message: string, details?: Record<string, unknown>): DomainError =>
  domainError('CONFLICT', message, details);

export const forbidden = (message = 'You do not have permission to perform this action'): DomainError =>
  domainError('FORBIDDEN', message);
