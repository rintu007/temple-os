import type { Country, Currency } from '@templeos/validators';

export interface OrganizationSummary {
  id: string;
  name: string;
  slug: string;
  country: Country;
  currency: Currency;
  status: 'pending' | 'active' | 'suspended';
}

export const SYSTEM_ROLES = [
  { key: 'owner', name: 'Owner' },
  { key: 'admin', name: 'Administrator' },
  { key: 'manager', name: 'Manager' },
  { key: 'staff', name: 'Staff' },
  { key: 'viewer', name: 'Viewer' },
] as const;

export type SystemRoleKey = (typeof SYSTEM_ROLES)[number]['key'];
