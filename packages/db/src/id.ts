import { uuidv7 } from 'uuidv7';

/**
 * Client-generated, time-ordered UUID v7. Generating ids app-side (rather than
 * in the database) lets provisioning set the RLS tenant context to the new
 * organization's id before its row exists.
 */
export function newId(): string {
  return uuidv7();
}
