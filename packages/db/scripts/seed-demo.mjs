/**
 * Dev seed: a 'demo' organization + subdomain so {NEXT_PUBLIC_ROOT_DOMAIN}
 * has a working tenant site locally. Idempotent. Uses the RLS-enforced
 * runtime connection deliberately — seeding exercises the same tenant-context
 * path the app uses.
 */
import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { loadEnv, requireDatabaseUrl } from './env.mjs';

loadEnv();
const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'localhost';
const hostname = `demo.${root}`;
const sql = postgres(requireDatabaseUrl(), { prepare: false, max: 1, onnotice: () => {} });

async function seedTemple(orgId) {
  await sql.begin(async (tx) => {
    await tx`SELECT set_config('app.current_org_id', ${orgId}, true)`;
    const found = await tx`SELECT id FROM temples WHERE organization_id = ${orgId} AND slug = 'main'`;
    if (found.length > 0) {
      console.log('Demo temple already seeded');
      return;
    }
    const templeId = randomUUID();
    await tx`INSERT INTO temples (id, organization_id, name, slug, deity, city, state, country)
             VALUES (${templeId}, ${orgId}, 'Sri Demo Kalibari', 'main', 'Maa Kali', 'Kolkata', 'West Bengal', 'IN')`;
    for (const [title, start, end, note] of [
      ['Mangala Aarti', '05:30', '06:00', 'Morning invocation'],
      ['Pushpanjali', '09:00', '09:30', null],
      ['Bhog & Prasad', '12:30', '13:30', 'Anna bhog distribution'],
      ['Sandhya Aarti', '18:30', '19:15', 'Evening aarti with dhak'],
    ]) {
      await tx`INSERT INTO daily_schedules (id, organization_id, temple_id, title, start_time, end_time, description)
               VALUES (${randomUUID()}, ${orgId}, ${templeId}, ${title}, ${start}, ${end}, ${note})`;
    }
    console.log('Seeded demo temple with daily schedule');
  });
}

async function seedEvents(orgId) {
  await sql.begin(async (tx) => {
    await tx`SELECT set_config('app.current_org_id', ${orgId}, true)`;
    const found = await tx`SELECT id FROM events WHERE organization_id = ${orgId} LIMIT 1`;
    if (found.length > 0) {
      console.log('Demo events already seeded');
      return;
    }
    const day = 86_400_000;
    const at = (days, hours = 0) => new Date(Date.now() + days * day + hours * 3_600_000);
    await tx`INSERT INTO events (id, organization_id, kind, title, description, location, starts_at, ends_at, all_day)
             VALUES (${randomUUID()}, ${orgId}, 'event', 'Weekly Satsang', 'Bhajan and discourse, open to all', 'Main hall', ${at(5, 18)}, ${at(5, 20)}, false)`;
    await tx`INSERT INTO events (id, organization_id, kind, title, description, starts_at, ends_at, all_day)
             VALUES (${randomUUID()}, ${orgId}, 'festival', 'Janmashtami Celebration', 'Midnight abhishek and prasad distribution', ${at(21)}, ${at(22)}, true)`;
    console.log('Seeded demo events');
  });
}

try {
  const existing = await sql`SELECT organization_id FROM domains WHERE hostname = ${hostname}`;
  if (existing.length > 0) {
    console.log(`Demo org already seeded (${hostname})`);
    await seedTemple(existing[0].organization_id);
    await seedEvents(existing[0].organization_id);
  } else {
    const orgId = randomUUID();
    await sql.begin(async (tx) => {
      await tx`SELECT set_config('app.current_org_id', ${orgId}, true)`;
      await tx`INSERT INTO organizations (id, name, slug, country, currency, status)
               VALUES (${orgId}, 'Sri Demo Kalibari', 'demo', 'IN', 'INR', 'active')`;
      await tx`INSERT INTO domains (id, organization_id, hostname, type, is_primary, verified_at)
               VALUES (${randomUUID()}, ${orgId}, ${hostname}, 'subdomain', true, now())`;
      for (const [key, name] of [
        ['owner', 'Owner'],
        ['admin', 'Administrator'],
        ['manager', 'Manager'],
        ['staff', 'Staff'],
        ['viewer', 'Viewer'],
      ]) {
        await tx`INSERT INTO roles (id, organization_id, key, name, is_system)
                 VALUES (${randomUUID()}, ${orgId}, ${key}, ${name}, true)`;
      }
      await tx`INSERT INTO audit_logs (id, organization_id, action, entity_type, entity_id, after)
               VALUES (${randomUUID()}, ${orgId}, 'organization.created', 'organization', ${orgId},
                       ${JSON.stringify({ name: 'Sri Demo Kalibari', slug: 'demo', seed: true })}::jsonb)`;
    });
    console.log(`Seeded demo org at ${hostname}`);
    const [row] = await sql`SELECT organization_id FROM domains WHERE hostname = ${hostname}`;
    await seedTemple(row.organization_id);
    await seedEvents(row.organization_id);
  }
} finally {
  await sql.end();
}
