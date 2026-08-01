import { eq } from 'drizzle-orm';
import { users, withTenantContext, type Db } from '@templeos/db';

export function createProfileRepository(db: Db) {
  return {
    async updateFullName(userId: string, fullName: string) {
      return withTenantContext(db, { userId }, async (tx) => {
        const [row] = await tx
          .update(users)
          .set({ fullName })
          .where(eq(users.id, userId))
          .returning({ id: users.id, email: users.email, fullName: users.fullName });
        return row ?? null;
      });
    },

    /** Mirrors a confirmed Supabase email change into the public.users row. */
    async syncEmail(userId: string, email: string) {
      return withTenantContext(db, { userId }, async (tx) => {
        await tx.update(users).set({ email }).where(eq(users.id, userId));
      });
    },
  };
}

export type ProfileRepository = ReturnType<typeof createProfileRepository>;
