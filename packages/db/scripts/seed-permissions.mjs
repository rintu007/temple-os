/**
 * One-time (idempotent) seed of the global `permissions` catalog table —
 * role_permissions.permission_key FK-references it. Runs on the admin
 * (bypass-RLS) connection since the app role only has SELECT on this table
 * (see sql/0001_rls_policies.sql: permissions_read_all).
 *
 * Keep this list in sync with PERMISSION_GROUPS in
 * packages/core/src/shared/authorize.ts — re-run after adding a permission.
 */
import postgres from 'postgres';
import { loadEnv, requireAdminDatabaseUrl } from './env.mjs';

loadEnv();
const sql = postgres(requireAdminDatabaseUrl(), { prepare: false, max: 1, onnotice: () => {} });

const PERMISSIONS = [
  ['organization:manage', 'Full organization management'],
  ['temples:read', 'View temples'],
  ['temples:write', 'Create & edit temples'],
  ['schedules:write', 'Create & edit daily schedules'],
  ['devotees:read', 'View devotees'],
  ['devotees:write', 'Create & edit devotees'],
  ['donations:read', 'View donations'],
  ['donations:write', 'Record & edit donations'],
  ['donations:void', 'Void a recorded donation'],
  ['expenses:read', 'View expenses'],
  ['expenses:write', 'Record & edit expenses'],
  ['expenses:void', 'Void a recorded expense'],
  ['expenses:approve', 'Approve an expense'],
  ['funds:read', 'View funds'],
  ['funds:write', 'Create & edit funds'],
  ['accounts:read', 'View bank & cash accounts'],
  ['accounts:write', 'Create & edit bank & cash accounts'],
  ['payroll:read', 'View payroll'],
  ['payroll:write', 'Create & edit payroll'],
  ['loans:read', 'View loans & advances'],
  ['loans:write', 'Create & edit loans & advances'],
  ['investments:read', 'View investments'],
  ['investments:write', 'Create & edit investments'],
  ['grants:read', 'View grants'],
  ['grants:write', 'Create & edit grants'],
  ['budgets:read', 'View budgets'],
  ['budgets:write', 'Create & edit budgets'],
  ['tax:read', 'View 80G & tax records'],
  ['tax:write', 'Create & edit 80G & tax records'],
  ['events:read', 'View events'],
  ['events:write', 'Create & edit events'],
  ['pujas:read', 'View pujas'],
  ['pujas:write', 'Create & edit pujas'],
  ['sevas:read', 'View sevas'],
  ['sevas:write', 'Create & edit sevas'],
  ['membership:read', 'View membership'],
  ['membership:write', 'Create & edit membership'],
  ['reports:read', 'View reports'],
  ['website:read', 'View website content'],
  ['website:write', 'Create & edit website content'],
  ['volunteers:read', 'View volunteers'],
  ['volunteers:write', 'Create & edit volunteers'],
  ['facilities:read', 'View facilities'],
  ['facilities:write', 'Create & edit facilities'],
  ['prasadam:read', 'View annadanam / prasadam'],
  ['prasadam:write', 'Create & edit annadanam / prasadam'],
  ['assets:read', 'View assets'],
  ['assets:write', 'Create & edit assets'],
  ['governance:read', 'View governance records (activity, officers, meetings)'],
  ['governance:write', 'Create & edit governance records'],
  ['inventory:read', 'View inventory'],
  ['inventory:write', 'Create & edit inventory'],
  ['darshan:read', 'View darshan'],
  ['darshan:write', 'Create & edit darshan'],
  ['communications:read', 'View communications'],
  ['communications:write', 'Create & edit communications'],
  ['overview:read', 'View dashboard overview'],
];

for (const [key, description] of PERMISSIONS) {
  await sql`
    INSERT INTO permissions (key, description) VALUES (${key}, ${description})
    ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description
  `;
}
console.log(`Seeded ${PERMISSIONS.length} permissions`);
await sql.end();
