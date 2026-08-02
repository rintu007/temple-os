import { eq, sql } from 'drizzle-orm';
import { healthChecks, type Db } from '@templeos/db';
import type { AlertRecipient, ServiceStatus } from './health.types';

export function createHealthRepository(db: Db) {
  return {
    async getStatus(service: string): Promise<ServiceStatus | null> {
      const [row] = await db
        .select({ status: healthChecks.status })
        .from(healthChecks)
        .where(eq(healthChecks.service, service))
        .limit(1);
      return (row?.status as ServiceStatus | undefined) ?? null;
    },

    async setStatus(service: string, status: ServiceStatus): Promise<void> {
      await db
        .insert(healthChecks)
        .values({ service, status, updatedAt: new Date() })
        .onConflictDoUpdate({
          target: healthChecks.service,
          set: { status, updatedAt: new Date() },
        });
    },

    /** Touches no table, so no RLS/tenant context is involved. */
    async checkConnectivity(): Promise<boolean> {
      try {
        await db.execute(sql`SELECT 1`);
        return true;
      } catch {
        return false;
      }
    },

    /** SECURITY DEFINER — no session context needed, see 0009_health_monitoring.sql. */
    async listAlertRecipients(): Promise<AlertRecipient[]> {
      const rows = await db.execute<{ email: string; full_name: string | null }>(
        sql`SELECT * FROM app_list_platform_admin_emails()`,
      );
      return rows.map((r) => ({ email: r.email, fullName: r.full_name }));
    },
  };
}

export type HealthRepository = ReturnType<typeof createHealthRepository>;
