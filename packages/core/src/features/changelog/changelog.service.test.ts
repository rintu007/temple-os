import { randomUUID } from 'node:crypto';
import { eq, inArray } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { changelogEntries, changelogReads, createDb, platformAdmins, users } from '@templeos/db';
import { createChangelogService } from './changelog.service';

const hasDb = Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL_ADMIN);

describe.skipIf(!hasDb)('changelog: platform-wide "what\'s new" feed (live db)', () => {
  const db = createDb();
  const admin = createDb(process.env.DATABASE_URL_ADMIN);
  const changelog$ = createChangelogService({ db });

  const run = `changelog${Date.now().toString(36)}`;
  const staffer = { userId: randomUUID(), email: `staff-${run}@test.invalid` };
  const reader = { userId: randomUUID(), email: `reader-${run}@test.invalid` };
  let entryId = '';

  afterAll(async () => {
    if (entryId) await admin.delete(changelogEntries).where(eq(changelogEntries.id, entryId));
    await admin.delete(changelogReads).where(inArray(changelogReads.userId, [staffer.userId, reader.userId]));
    await admin.delete(platformAdmins).where(eq(platformAdmins.userId, staffer.userId));
    await admin.delete(users).where(inArray(users.id, [staffer.userId, reader.userId]));
    await db.$client.end();
    await admin.$client.end();
  });

  it('sets up a platform admin and a plain user', async () => {
    await admin.insert(users).values([
      { id: staffer.userId, email: staffer.email },
      { id: reader.userId, email: reader.email },
    ]);
    await admin.insert(platformAdmins).values({ userId: staffer.userId, note: 'test grant' });
  });

  it('denies creating an entry to a non-platform-admin', async () => {
    const created = await changelog$.createEntry(reader.userId, {
      title: 'Should not work',
      body: 'nope',
    });
    expect(created.ok).toBe(false);
    if (!created.ok) expect(created.error.code).toBe('FORBIDDEN');
  });

  it('a platform admin publishes an entry, readable by any signed-in user', async () => {
    const created = await changelog$.createEntry(staffer.userId, {
      title: 'New: bulk devotee import',
      body: 'You can now import a CSV of devotees all at once.',
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    entryId = created.value.id;

    const feed = await changelog$.getFeed(reader.userId);
    expect(feed.items.some((i) => i.id === entryId)).toBe(true);
    expect(feed.unreadCount).toBeGreaterThan(0);
    expect(feed.items.find((i) => i.id === entryId)?.unread).toBe(true);
  });

  it('marking read clears unread state for that user only', async () => {
    await changelog$.markRead(reader.userId);
    const readerFeed = await changelog$.getFeed(reader.userId);
    expect(readerFeed.unreadCount).toBe(0);
    expect(readerFeed.items.find((i) => i.id === entryId)?.unread).toBe(false);

    const stafferFeed = await changelog$.getFeed(staffer.userId);
    expect(stafferFeed.items.find((i) => i.id === entryId)?.unread).toBe(true);
  });

  it('deleting an entry: not found for a bogus id, forbidden for a non-admin', async () => {
    const missing = await changelog$.deleteEntry(staffer.userId, randomUUID());
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.error.code).toBe('NOT_FOUND');

    const forbidden = await changelog$.deleteEntry(reader.userId, entryId);
    expect(forbidden.ok).toBe(false);
    if (!forbidden.ok) expect(forbidden.error.code).toBe('FORBIDDEN');
  });

  it('a platform admin deletes the entry', async () => {
    const deleted = await changelog$.deleteEntry(staffer.userId, entryId);
    expect(deleted.ok).toBe(true);

    const feed = await changelog$.getFeed(reader.userId);
    expect(feed.items.some((i) => i.id === entryId)).toBe(false);
    entryId = '';
  });
});
