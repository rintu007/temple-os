import {
  createEventService,
  createOrganizationService,
  createPaymentService,
  createTempleService,
  type EventService,
  type OrganizationService,
  type PaymentService,
  type TempleService,
} from '@templeos/core';
import { getDb } from '@templeos/db';

/** Lazy singletons — importing this module never touches env/DB at build time. */
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

let _eventService: EventService | undefined;

export function eventService(): EventService {
  _eventService ??= createEventService({ db: getDb() });
  return _eventService;
}

let _paymentService: PaymentService | undefined;

export function paymentService(): PaymentService {
  _paymentService ??= createPaymentService({ db: getDb() });
  return _paymentService;
}

/** The middleware passes a subdomain slug or a full custom-domain hostname. */
export function hostnameFromDomainParam(domainParam: string): string {
  const decoded = decodeURIComponent(domainParam).toLowerCase();
  if (decoded.includes('.')) return decoded;
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'localhost';
  return `${decoded}.${root}`;
}
