import { cache } from 'react';
import {
  createCampaignService,
  createEventService,
  createFacilityService,
  createGalleryService,
  createMembershipService,
  createOrganizationService,
  createPaymentService,
  createPujaService,
  createTempleService,
  createWebhookService,
  createVolunteerService,
  createWebsiteService,
  type CampaignService,
  type EventService,
  type FacilityService,
  type GalleryService,
  type MembershipService,
  type OrganizationService,
  type PaymentService,
  type PujaService,
  type TempleService,
  type WebhookService,
  type VolunteerService,
  type WebsiteService,
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

let _campaignService: CampaignService | undefined;

export function campaignService(): CampaignService {
  _campaignService ??= createCampaignService({ db: getDb() });
  return _campaignService;
}

let _facilityService: FacilityService | undefined;

export function facilityService(): FacilityService {
  _facilityService ??= createFacilityService({ db: getDb() });
  return _facilityService;
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

let _pujaService: PujaService | undefined;

export function pujaService(): PujaService {
  _pujaService ??= createPujaService({ db: getDb() });
  return _pujaService;
}

let _membershipService: MembershipService | undefined;

export function membershipService(): MembershipService {
  _membershipService ??= createMembershipService({ db: getDb() });
  return _membershipService;
}

let _webhookService: WebhookService | undefined;

export function webhookService(): WebhookService {
  _webhookService ??= createWebhookService({ db: getDb() });
  return _webhookService;
}

let _volunteerService: VolunteerService | undefined;

export function volunteerService(): VolunteerService {
  _volunteerService ??= createVolunteerService({ db: getDb() });
  return _volunteerService;
}

let _websiteService: WebsiteService | undefined;

export function websiteService(): WebsiteService {
  _websiteService ??= createWebsiteService({ db: getDb() });
  return _websiteService;
}

let _galleryService: GalleryService | undefined;

export function galleryService(): GalleryService {
  _galleryService ??= createGalleryService({ db: getDb() });
  return _galleryService;
}

/** Per-request memoized host→tenant resolution (layout + page share one query). */
export const resolveSite = cache((domainParam: string) =>
  organizationService().resolveSiteByHostname(hostnameFromDomainParam(domainParam)),
);

/** The middleware passes a subdomain slug or a full custom-domain hostname. */
export function hostnameFromDomainParam(domainParam: string): string {
  const decoded = decodeURIComponent(domainParam).toLowerCase();
  if (decoded.includes('.')) return decoded;
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'localhost';
  return `${decoded}.${root}`;
}
