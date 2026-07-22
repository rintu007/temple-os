import {
  createDevoteeService,
  createDonationService,
  createEventService,
  createGalleryService,
  createMemberService,
  createMembershipService,
  createOrganizationService,
  createPujaService,
  createReportService,
  createTempleService,
  createWebsiteService,
  type DevoteeService,
  type DonationService,
  type EventService,
  type GalleryService,
  type MemberService,
  type MembershipService,
  type OrganizationService,
  type PujaService,
  type ReportService,
  type TempleService,
  type WebsiteService,
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

let _eventService: EventService | undefined;

export function eventService(): EventService {
  _eventService ??= createEventService({ db: getDb() });
  return _eventService;
}

let _memberService: MemberService | undefined;

export function memberService(): MemberService {
  _memberService ??= createMemberService({ db: getDb() });
  return _memberService;
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

let _reportService: ReportService | undefined;

export function reportService(): ReportService {
  _reportService ??= createReportService({ db: getDb() });
  return _reportService;
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
