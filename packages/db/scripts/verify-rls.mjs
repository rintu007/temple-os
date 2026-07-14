/**
 * RLS smoke check against the live database — the seed of the tenancy
 * leakage suite. Verifies that without a tenant context nothing is visible
 * or writable, and that SET LOCAL app.current_org_id opens exactly one
 * organization's data. All writes are rolled back.
 */
import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { loadEnv, requireDatabaseUrl } from './env.mjs';

loadEnv();
const sql = postgres(requireDatabaseUrl(), { prepare: false, max: 1, onnotice: () => {} });

let failures = 0;
function check(name, condition, detail = '') {
  const status = condition ? 'PASS' : 'FAIL';
  if (!condition) failures += 1;
  console.log(`  [${status}] ${name}${detail ? ` — ${detail}` : ''}`);
}

try {
  // 0. The runtime role must not be able to bypass RLS at all.
  const [role] = await sql`SELECT current_user, rolbypassrls FROM pg_roles WHERE rolname = current_user`;
  console.log(`Connected as: ${role.current_user}\n`);
  check('Runtime role cannot bypass RLS', role.rolbypassrls === false, `bypassrls=${role.rolbypassrls}`);

  console.log('\nRLS status per table:');
  const tables = await sql`
    SELECT c.relname, c.relrowsecurity AS rls, c.relforcerowsecurity AS forced
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
    ORDER BY c.relname`;
  for (const t of tables) {
    console.log(`  ${t.relname.padEnd(20)} rls=${t.rls} forced=${t.forced}`);
  }

  console.log('\nTenant isolation checks:');

  // 1. No tenant context → tenant tables must appear empty.
  const [orgs] = await sql`SELECT count(*)::int AS c FROM organizations`;
  check('SELECT without tenant context sees no organizations', orgs.c === 0, `saw ${orgs.c}`);

  // 2. No tenant context → writes must be rejected. Wrapped in a rolled-back
  //    transaction so a failing check can never leave residue behind.
  let insertBlocked = false;
  const ROLLBACK_INSERT = new Error('intentional rollback');
  await sql
    .begin(async (tx) => {
      try {
        await tx`INSERT INTO organizations (id, name, slug, country, currency)
                 VALUES (${randomUUID()}, 'Blocked', 'rls-blocked-test', 'IN', 'INR')`;
      } catch {
        insertBlocked = true;
      }
      throw ROLLBACK_INSERT;
    })
    .catch((e) => {
      if (e !== ROLLBACK_INSERT) throw e;
    });
  check('INSERT without tenant context is blocked', insertBlocked);

  // 3. With SET LOCAL app.current_org_id → own-org insert and select work (rolled back).
  const orgId = randomUUID();
  const otherOrgId = randomUUID();
  let visibleInTx = -1;
  let crossTenantVisible = -1;
  const ROLLBACK = new Error('intentional rollback');
  await sql
    .begin(async (tx) => {
      await tx`SELECT set_config('app.current_org_id', ${orgId}, true)`;
      await tx`INSERT INTO organizations (id, name, slug, country, currency, status)
               VALUES (${orgId}, 'RLS Test Org', 'rls-test-tmp', 'IN', 'INR', 'active')`;
      const [own] = await tx`SELECT count(*)::int AS c FROM organizations WHERE id = ${orgId}`;
      visibleInTx = own.c;
      // Switch tenant inside the same tx: the first org must disappear.
      await tx`SELECT set_config('app.current_org_id', ${otherOrgId}, true)`;
      const [cross] = await tx`SELECT count(*)::int AS c FROM organizations WHERE id = ${orgId}`;
      crossTenantVisible = cross.c;
      throw ROLLBACK;
    })
    .catch((e) => {
      if (e !== ROLLBACK) throw e;
    });
  check('INSERT + SELECT within own tenant context works', visibleInTx === 1);
  check('Other tenant cannot see the row', crossTenantVisible === 0);

  // 4. Nothing leaked past the rollback.
  const [after] = await sql`SELECT count(*)::int AS c FROM organizations`;
  check('Rollback left no residue visible', after.c === 0);

  console.log(failures === 0 ? '\nAll RLS checks passed.' : `\n${failures} RLS check(s) FAILED.`);
  process.exit(failures === 0 ? 0 : 1);
} finally {
  await sql.end();
}
