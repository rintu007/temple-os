/**
 * Creates/updates the `templeos_app` runtime role: LOGIN, NOBYPASSRLS, CRUD on
 * public schema. The app connects as this role so RLS policies actually apply
 * (Supabase's `postgres` role has BYPASSRLS and must stay admin/migrations-only).
 *
 * Usage: APP_DB_PASSWORD=... node scripts/create-app-role.mjs
 * Connects via DATABASE_URL_ADMIN.
 */
import postgres from 'postgres';
import { loadEnv, requireAdminDatabaseUrl } from './env.mjs';

loadEnv();
const password = process.env.APP_DB_PASSWORD;
if (!password) {
  console.error('APP_DB_PASSWORD is not set');
  process.exit(1);
}
if (!/^[A-Za-z0-9]+$/.test(password)) {
  // Keeps the literal safe to inline and the connection URL free of encoding issues.
  console.error('APP_DB_PASSWORD must be alphanumeric');
  process.exit(1);
}

const sql = postgres(requireAdminDatabaseUrl(), { prepare: false, max: 1, onnotice: () => {} });

try {
  await sql.unsafe(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'templeos_app') THEN
        CREATE ROLE templeos_app LOGIN NOBYPASSRLS;
      END IF;
    END $$;
  `);
  await sql.unsafe(`ALTER ROLE templeos_app LOGIN NOBYPASSRLS PASSWORD '${password}'`);
  await sql.unsafe(`
    GRANT USAGE ON SCHEMA public TO templeos_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO templeos_app;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public
      GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO templeos_app;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO templeos_app;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public
      GRANT USAGE, SELECT ON SEQUENCES TO templeos_app;
  `);
  const [role] = await sql`SELECT rolname, rolbypassrls FROM pg_roles WHERE rolname = 'templeos_app'`;
  console.log(`Role ready: ${role.rolname} (bypassrls=${role.rolbypassrls})`);
} finally {
  await sql.end();
}
