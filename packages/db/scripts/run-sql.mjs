/** Apply a raw SQL file (e.g. RLS policies) to DATABASE_URL. Usage: node scripts/run-sql.mjs <file.sql> */
import postgres from 'postgres';
import { loadEnv, requireAdminDatabaseUrl } from './env.mjs';

const file = process.argv[2];
if (!file) {
  console.error('Usage: node scripts/run-sql.mjs <file.sql>');
  process.exit(1);
}

loadEnv();
const sql = postgres(requireAdminDatabaseUrl(), { prepare: false, max: 1, onnotice: () => {} });

try {
  await sql.file(file);
  console.log(`Applied ${file}`);
} finally {
  await sql.end();
}
