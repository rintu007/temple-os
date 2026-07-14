/** Apply raw SQL files (e.g. RLS policies) in order. Usage: node scripts/run-sql.mjs <a.sql> [b.sql ...] */
import postgres from 'postgres';
import { loadEnv, requireAdminDatabaseUrl } from './env.mjs';

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('Usage: node scripts/run-sql.mjs <file.sql> [more.sql ...]');
  process.exit(1);
}

loadEnv();
const sql = postgres(requireAdminDatabaseUrl(), { prepare: false, max: 1, onnotice: () => {} });

try {
  for (const file of files) {
    await sql.file(file);
    console.log(`Applied ${file}`);
  }
} finally {
  await sql.end();
}
