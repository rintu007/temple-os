import {
  createDevoteeService,
  createDonationService,
  createOrganizationService,
  createTempleService,
  type DevoteeService,
  type DonationService,
  type OrganizationService,
  type TempleService,
} from '@templeos/core';
import { getDb } from '@templeos/db';

/**
 * Lazily-constructed service singletons. Lazy so importing a module never
 * requires env/DB at build time — only actual requests do.
 */
let _organizationService: OrganizationService | undefined;
let _templeService: TempleService | undefined;

export function organizationService(): OrganizationService {
  _organizationService ??= createOrganizationService({
    db: getDb(),
    rootDomain: process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'localhost',
  });
  return _organizationService;
}

export function templeService(): TempleService {
  _templeService ??= createTempleService({ db: getDb() });
  return _templeService;
}

let _devoteeService: DevoteeService | undefined;

export function devoteeService(): DevoteeService {
  _devoteeService ??= createDevoteeService({ db: getDb() });
  return _devoteeService;
}

let _donationService: DonationService | undefined;

export function donationService(): DonationService {
  _donationService ??= createDonationService({ db: getDb() });
  return _donationService;
}
