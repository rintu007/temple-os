import { z } from 'zod';
import { PLATFORM_PLANS } from './billing';

/** Mirrors packages/db's platform_subscription_status enum. */
export const PLATFORM_SUBSCRIPTION_STATUSES = ['trialing', 'active', 'past_due', 'canceled'] as const;
export type PlatformSubscriptionStatusInput = (typeof PLATFORM_SUBSCRIPTION_STATUSES)[number];

/**
 * A platform admin's manual override of one org's subscription — support
 * actions like comping a plan, un-sticking a past_due account, or extending
 * a trial. Every field is optional; the service rejects an all-empty input.
 */
export const platformOverrideSchema = z.object({
  plan: z.enum(PLATFORM_PLANS).optional(),
  status: z.enum(PLATFORM_SUBSCRIPTION_STATUSES).optional(),
  extendTrialDays: z.coerce.number().int().min(1).max(365).optional(),
});
export type PlatformOverrideInput = z.infer<typeof platformOverrideSchema>;

export const ORGANIZATION_ADMIN_STATUSES = ['active', 'suspended'] as const;
export type OrganizationAdminStatus = (typeof ORGANIZATION_ADMIN_STATUSES)[number];
