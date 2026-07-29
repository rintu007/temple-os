import type { ModuleKey } from '@templeos/validators';

/**
 * Maps a nav href's top-level route segment to the gateable module it
 * belongs to. Anything not listed here is "core" — included on every plan,
 * even the free Starter tier (dashboard, insights, temples, devotees,
 * donations, events, team, activity, website, billing).
 */
const ROUTE_MODULE: Record<string, ModuleKey> = {
  pujas: 'worship',
  sevas: 'worship',
  prasadam: 'worship',
  darshan: 'worship',
  facilities: 'worship',
  membership: 'community',
  volunteers: 'community',
  officers: 'community',
  communications: 'community',
  meetings: 'community',
  'in-kind': 'finance-basic',
  pledges: 'finance-basic',
  hundi: 'finance-basic',
  campaigns: 'finance-basic',
  expenses: 'finance-basic',
  recurring: 'finance-basic',
  accounts: 'accounting',
  transfers: 'accounting',
  payroll: 'accounting',
  loans: 'accounting',
  investments: 'accounting',
  funds: 'accounting',
  grants: 'accounting',
  vendors: 'accounting',
  assets: 'accounting',
  inventory: 'accounting',
  reports: 'accounting',
  budgets: 'accounting',
  statements: 'accounting',
  'annual-report': 'accounting',
  tax: 'accounting',
};

/** Null means the route is core — never gated. */
export function moduleForHref(href: string): ModuleKey | null {
  const segment = href.replace(/^\//, '').split('/')[0] ?? '';
  return ROUTE_MODULE[segment] ?? null;
}
