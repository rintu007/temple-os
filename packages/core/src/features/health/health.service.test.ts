import { randomUUID } from 'node:crypto';
import { eq, inArray } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { createDb, healthChecks, platformAdmins, users } from '@templeos/db';
import { createHealthService } from './health.service';

const hasDb = Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL_ADMIN);

describe.skipIf(!hasDb)('health monitoring: state-transition detection (live db)', () => {
  const db = createDb();
  const admin = createDb(process.env.DATABASE_URL_ADMIN);
  const health$ = createHealthService({ db });
  const run = `health${Date.now().toString(36)}`;
  const staffer = { userId: randomUUID(), email: `staff-${run}@test.invalid` };

  afterAll(async () => {
    await admin.delete(healthChecks).where(inArray(healthChecks.service, [`${run}-svc`, 'db']));
    await admin.delete(platformAdmins).where(eq(platformAdmins.userId, staffer.userId));
    await admin.delete(users).where(eq(users.id, staffer.userId));
    await db.$client.end();
    await admin.$client.end();
  });

  it('a real DB connectivity check reports up', async () => {
    const result = await health$.checkDb();
    expect(result.currentStatus).toBe('up');
  });

  it('the first-ever check for a service is never treated as a transition', async () => {
    const service = `${run}-svc`;
    const first = await health$.recordExternalCheck(service, true);
    expect(first.previousStatus).toBeNull();
    expect(first.changed).toBe(false);
    expect(first.currentStatus).toBe('up');
  });

  it('flags a genuine up→down→up transition, but not repeated same-status checks', async () => {
    const service = `${run}-svc`;

    const stillUp = await health$.recordExternalCheck(service, true);
    expect(stillUp.changed).toBe(false);

    const wentDown = await health$.recordExternalCheck(service, false);
    expect(wentDown.previousStatus).toBe('up');
    expect(wentDown.currentStatus).toBe('down');
    expect(wentDown.changed).toBe(true);

    const stillDown = await health$.recordExternalCheck(service, false);
    expect(stillDown.changed).toBe(false);

    const recovered = await health$.recordExternalCheck(service, true);
    expect(recovered.previousStatus).toBe('down');
    expect(recovered.currentStatus).toBe('up');
    expect(recovered.changed).toBe(true);
  });

  it('lists platform admin emails as alert recipients', async () => {
    await admin.insert(users).values({ id: staffer.userId, email: staffer.email });
    await admin.insert(platformAdmins).values({ userId: staffer.userId, note: 'test grant' });

    const recipients = await health$.getAlertRecipients();
    expect(recipients.some((r) => r.email === staffer.email)).toBe(true);
  });
});
