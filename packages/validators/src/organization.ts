import { z } from 'zod';
import { RESERVED_SLUGS, slugSchema } from './shared';

export const countrySchema = z.enum(['IN', 'BD', 'US', 'GB', 'CA', 'AU']);
export type Country = z.infer<typeof countrySchema>;

export const currencySchema = z.enum(['INR', 'BDT', 'USD', 'GBP', 'CAD', 'AUD']);
export type Currency = z.infer<typeof currencySchema>;

/** The organization's country determines currency and, in turn, payment provider. */
export const CURRENCY_BY_COUNTRY: Record<Country, Currency> = {
  IN: 'INR',
  BD: 'BDT',
  US: 'USD',
  GB: 'GBP',
  CA: 'CAD',
  AU: 'AUD',
};

export const COUNTRY_NAMES: Record<Country, string> = {
  IN: 'India',
  BD: 'Bangladesh',
  US: 'United States',
  GB: 'United Kingdom',
  CA: 'Canada',
  AU: 'Australia',
};

/** Symbol shown next to amounts on donor-facing forms and receipts. */
export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  INR: '₹',
  BDT: '৳',
  USD: '$',
  GBP: '£',
  CAD: 'C$',
  AUD: 'A$',
};

/** What the onboarding form submits. Owner identity comes from the verified session, never the form. */
export const createOrganizationSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(120),
  slug: slugSchema.refine((s) => !RESERVED_SLUGS.has(s), 'This subdomain is reserved'),
  country: countrySchema,
});

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
