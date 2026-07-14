import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export type Db = ReturnType<typeof createDb>;
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

export function createDb(connectionString?: string) {
  const url = connectionString ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not set');
  }
  // prepare:false — required behind Supabase's transaction-mode pooler (pgBouncer)
  const client = postgres(url, { prepare: false });
  return drizzle(client, { schema, casing: 'snake_case' });
}

/**
 * Serverless-safe singleton: reuse the connection pool across hot reloads and
 * lambda invocations instead of exhausting Postgres connections.
 */
const globalForDb = globalThis as unknown as { __templeosDb?: Db };

export function getDb(): Db {
  if (!globalForDb.__templeosDb) {
    globalForDb.__templeosDb = createDb();
  }
  return globalForDb.__templeosDb;
}
