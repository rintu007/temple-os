export type ServiceStatus = 'up' | 'down';

export interface HealthCheckResult {
  service: string;
  previousStatus: ServiceStatus | null;
  currentStatus: ServiceStatus;
  changed: boolean;
}

export interface AlertRecipient {
  email: string;
  fullName: string | null;
}
