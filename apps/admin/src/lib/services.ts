import {
  createAssetService,
  createDevoteeService,
  createDonationService,
  createCampaignService,
  createEventService,
  createFacilityService,
  createExpenseService,
  createGalleryService,
  createHundiService,
  createMeetingService,
  createMemberService,
  createMembershipService,
  createOrganizationService,
  createOverviewService,
  createPrasadamService,
  createPujaService,
  createReportService,
  createTempleService,
  createVolunteerService,
  createWebsiteService,
  type AssetService,
  type DevoteeService,
  type DonationService,
  type CampaignService,
  type EventService,
  type FacilityService,
  type ExpenseService,
  type GalleryService,
  type HundiService,
  type MeetingService,
  type MemberService,
  type MembershipService,
  type OrganizationService,
  type OverviewService,
  type PrasadamService,
  type PujaService,
  type ReportService,
  type TempleService,
  type VolunteerService,
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

let _expenseService: ExpenseService | undefined;

export function expenseService(): ExpenseService {
  _expenseService ??= createExpenseService({ db: getDb() });
  return _expenseService;
}

let _reportService: ReportService | undefined;

export function reportService(): ReportService {
  _reportService ??= createReportService({ db: getDb() });
  return _reportService;
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

let _overviewService: OverviewService | undefined;

export function overviewService(): OverviewService {
  _overviewService ??= createOverviewService({ db: getDb() });
  return _overviewService;
}

let _hundiService: HundiService | undefined;

export function hundiService(): HundiService {
  _hundiService ??= createHundiService({ db: getDb() });
  return _hundiService;
}

let _prasadamService: PrasadamService | undefined;

export function prasadamService(): PrasadamService {
  _prasadamService ??= createPrasadamService({ db: getDb() });
  return _prasadamService;
}

let _assetService: AssetService | undefined;

export function assetService(): AssetService {
  _assetService ??= createAssetService({ db: getDb() });
  return _assetService;
}

let _meetingService: MeetingService | undefined;

export function meetingService(): MeetingService {
  _meetingService ??= createMeetingService({ db: getDb() });
  return _meetingService;
}
