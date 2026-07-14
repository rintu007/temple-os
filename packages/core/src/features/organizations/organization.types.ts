import type { Country, Currency } from '@templeos/validators';

export interface OrganizationSummary {
  id: string;
  name: string;
  slug: string;
  country: Country;
  currency: Currency;
  status: 'pending' | 'active' | 'suspended';
}

/** Verified identity of the signing-up user — from the Supabase session, never a form. */
export interface OwnerIdentity {
  userId: string;
  email: string;
  fullName?: string | null;
}

/** One row of "organizations I belong to" for context resolution / org switcher. */
export interface MembershipSummary {
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  organizationStatus: 'pending' | 'active' | 'suspended';
  country: Country;
  currency: Currency;
  roleKey: string;
  roleName: string;
}

/** Public-site tenant resolved from a hostname. */
export interface TenantSite {
  organizationId: string;
  name: string;
  slug: string;
  country: Country;
  currency: Currency;
}

export const SYSTEM_ROLES = [
  { key: 'owner', name: 'Owner' },
  { key: 'admin', name: 'Administrator' },
  { key: 'manager', name: 'Manager' },
  { key: 'staff', name: 'Staff' },
  { key: 'viewer', name: 'Viewer' },
] as const;

export type SystemRoleKey = (typeof SYSTEM_ROLES)[number]['key'];
