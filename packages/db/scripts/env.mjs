import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

/** Load the monorepo root .env (works from repo root or packages/db). */
export function loadEnv() {
  for (const candidate of ['.env', '../.env', '../../.env']) {
    const path = resolve(process.cwd(), candidate);
    if (existsSync(path)) {
      process.loadEnvFile(path);
      return;
    }
  }
}

/** Runtime connection — templeos_app role, RLS enforced. */
export function requireDatabaseUrl() {
  const url = process.env.DATABASE_URL;
  if (!url || url.includes('[YOUR-PASSWORD]')) {
    console.error('DATABASE_URL is not set (or still has the placeholder). Check the root .env.');
    process.exit(1);
  }
  return url;
}

/** Admin connection — postgres role (BYPASSRLS): migrations and role setup only. */
export function requireAdminDatabaseUrl() {
  const url = process.env.DATABASE_URL_ADMIN ?? process.env.DATABASE_URL;
  if (!url || url.includes('[YOUR-PASSWORD]')) {
    console.error('DATABASE_URL_ADMIN is not set (or still has the placeholder). Check the root .env.');
    process.exit(1);
  }
  return url;
}
