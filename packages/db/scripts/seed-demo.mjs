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

try {
  const existing = await sql`SELECT organization_id FROM domains WHERE hostname = ${hostname}`;
  if (existing.length > 0) {
    console.log(`Demo org already seeded (${hostname})`);
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
  }
} finally {
  await sql.end();
}
