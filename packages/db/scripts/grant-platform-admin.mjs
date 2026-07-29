/**
 * Grants (or revokes) platform-admin access — the ability to see the
 * cross-tenant /platform ops view in apps/admin. There is no self-service
 * UI for this by design (see packages/db/sql/0004_platform_admin_policies.sql),
 * so membership is managed via this script on the admin (bypass-RLS)
 * connection, matched by the account's email in the `users` table.
 *
 * Usage:
 *   node scripts/grant-platform-admin.mjs <email>              # grant
 *   node scripts/grant-platform-admin.mjs <email> --revoke      # revoke
 */
import postgres from 'postgres';
import { loadEnv, requireAdminDatabaseUrl } from './env.mjs';

loadEnv();

const [, , email, flag] = process.argv;
if (!email) {
  console.error('Usage: node scripts/grant-platform-admin.mjs <email> [--revoke]');
  process.exit(1);
}

const sql = postgres(requireAdminDatabaseUrl(), { prepare: false, max: 1, onnotice: () => {} });

try {
  const [user] = await sql`SELECT id, email FROM users WHERE email = ${email}`;
  if (!user) {
    console.error(`No user found with email ${email} — they must sign up/sign in at least once first.`);
    process.exit(1);
  }

  if (flag === '--revoke') {
    await sql`DELETE FROM platform_admins WHERE user_id = ${user.id}`;
    console.log(`Revoked platform-admin access for ${user.email} (${user.id}).`);
  } else {
    await sql`
      INSERT INTO platform_admins (user_id, note)
      VALUES (${user.id}, ${'granted via grant-platform-admin.mjs'})
      ON CONFLICT (user_id) DO NOTHING
    `;
    console.log(`Granted platform-admin access to ${user.email} (${user.id}).`);
  }
} finally {
  await sql.end();
}
