import { randomUUID } from 'node:crypto';
import { eq, inArray } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { createDb, users } from '@templeos/db';
import { createProfileService } from './profile.service';

const hasDb = Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL_ADMIN);

describe.skipIf(!hasDb)(
  'profile: updating your own name and syncing a confirmed email (live db)',
  () => {
    const db = createDb();
    const admin = createDb(process.env.DATABASE_URL_ADMIN);
    const service = createProfileService({ db });

    const run = `prof${Date.now().toString(36)}`;
    const user = { id: randomUUID(), email: `prof-${run}@test.invalid` };

    afterAll(async () => {
      await admin.delete(users).where(inArray(users.id, [user.id]));
      await db.$client.end();
      await admin.$client.end();
    });

    it('seeds a user', async () => {
      await admin
        .insert(users)
        .values({ id: user.id, email: user.email, fullName: 'Original Name' });
    });

    it('updates the full name', async () => {
      const result = await service.updateFullName(user.id, { fullName: 'New Name' });
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.fullName).toBe('New Name');
    });

    it('rejects a name that is too short', async () => {
      const result = await service.updateFullName(user.id, { fullName: 'A' });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe('VALIDATION');
    });

    it('returns not_found for an unknown user', async () => {
      const result = await service.updateFullName(randomUUID(), { fullName: 'Nobody' });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe('NOT_FOUND');
    });

    it('syncs a confirmed email change into the mirror row', async () => {
      const newEmail = `prof-new-${run}@test.invalid`;
      await service.syncEmail(user.id, newEmail);
      const [row] = await admin.select({ email: users.email }).from(users).where(eq(users.id, user.id));
      expect(row?.email).toBe(newEmail);
    });
  },
);
