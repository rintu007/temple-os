import type { Db } from '@templeos/db';
import { updateProfileSchema } from '@templeos/validators';
import { domainError, err, notFound, ok, type Result } from '../../shared';
import { createProfileRepository } from './profile.repository';
import type { ProfileSummary } from './profile.types';

export function createProfileService({ db }: { db: Db }) {
  const repo = createProfileRepository(db);

  return {
    /** Self-service: any signed-in user may rename their own mirror row, no RBAC gate needed. */
    async updateFullName(userId: string, rawInput: unknown): Promise<Result<ProfileSummary>> {
      const parsed = updateProfileSchema.safeParse(rawInput);
      if (!parsed.success) {
        return err(domainError('VALIDATION', parsed.error.issues[0]?.message ?? 'Invalid input'));
      }
      const row = await repo.updateFullName(userId, parsed.data.fullName);
      if (!row) return err(notFound('User'));
      return ok(row);
    },

    /**
     * Best-effort mirror sync — called from the auth callback once Supabase
     * confirms an email change. Never blocks the redirect if it fails.
     */
    async syncEmail(userId: string, email: string): Promise<void> {
      await repo.syncEmail(userId, email);
    },
  };
}

export type ProfileService = ReturnType<typeof createProfileService>;
