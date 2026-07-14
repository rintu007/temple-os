import { z } from 'zod';
import { RESERVED_SLUGS, slugSchema } from './shared';

export const countrySchema = z.enum(['IN', 'BD']);
export type Country = z.infer<typeof countrySchema>;

export const currencySchema = z.enum(['INR', 'BDT']);
export type Currency = z.infer<typeof currencySchema>;

/** Launch markets: the organization's country determines currency and payment provider. */
export const CURRENCY_BY_COUNTRY: Record<Country, Currency> = {
  IN: 'INR',
  BD: 'BDT',
};

/** What the onboarding form submits. Owner identity comes from the verified session, never the form. */
export const createOrganizationSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(120),
  slug: slugSchema.refine((s) => !RESERVED_SLUGS.has(s), 'This subdomain is reserved'),
  country: countrySchema,
});

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
