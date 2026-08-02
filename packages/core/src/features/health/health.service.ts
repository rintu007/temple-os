import type { Db } from '@templeos/db';
import { createHealthRepository } from './health.repository';
import type { AlertRecipient, HealthCheckResult, ServiceStatus } from './health.types';

export function createHealthService({ db }: { db: Db }) {
  const repo = createHealthRepository(db);

  return {
    async checkDb(): Promise<HealthCheckResult> {
      const isUp = await repo.checkConnectivity();
      return recordCheck(repo, 'db', isUp ? 'up' : 'down');
    },

    /** Caller supplies whether the pinged service responded — this feature has no opinion on how it was checked. */
    async recordExternalCheck(service: string, isUp: boolean): Promise<HealthCheckResult> {
      return recordCheck(repo, service, isUp ? 'up' : 'down');
    },

    async getAlertRecipients(): Promise<AlertRecipient[]> {
      return repo.listAlertRecipients();
    },

    /** Public status-page read — every known service's last-checked state. */
    async listStatuses() {
      return repo.listAll();
    },
  };
}

async function recordCheck(
  repo: ReturnType<typeof createHealthRepository>,
  service: string,
  currentStatus: ServiceStatus,
): Promise<HealthCheckResult> {
  const previousStatus = await repo.getStatus(service);
  await repo.setStatus(service, currentStatus);
  return {
    service,
    previousStatus,
    currentStatus,
    // A never-before-seen service shouldn't alert on its very first check.
    changed: previousStatus !== null && previousStatus !== currentStatus,
  };
}

export type HealthService = ReturnType<typeof createHealthService>;
