import { sql } from 'drizzle-orm';
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

/** Transaction-local identity for RLS. Values must come from verified sessions only. */
export interface TenantGucs {
  organizationId?: string | null;
  userId?: string | null;
}

/**
 * Runs `fn` in a transaction with the RLS settings applied via SET LOCAL:
 * `app.current_org_id` and `app.current_user_id`. This is the ONLY way
 * tenant data becomes visible — the runtime role cannot bypass RLS.
 * Settings reset automatically at transaction end.
 */
export async function withTenantContext<T>(
  db: Db,
  gucs: TenantGucs,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`
      SELECT set_config('app.current_org_id', ${gucs.organizationId ?? ''}, true),
             set_config('app.current_user_id', ${gucs.userId ?? ''}, true)
    `);
    return fn(tx);
  });
}
