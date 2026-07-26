import {
  createAssetService,
  createAuditService,
  createBudgetService,
  createCommunicationService,
  createDevoteeService,
  createDarshanService,
  createDonationService,
  createCampaignService,
  createEventService,
  createFacilityService,
  createExpenseService,
  createFundService,
  createGalleryService,
  createHundiService,
  createInventoryService,
  createMeetingService,
  createMemberService,
  createMembershipService,
  createOfficerService,
  createOrganizationService,
  createOverviewService,
  createPledgeService,
  createPrasadamService,
  createPujaService,
  createReportService,
  createStatementService,
  createTaxService,
  createTempleService,
  createVendorService,
  createVolunteerService,
  createWebsiteService,
  type AssetService,
  type AuditService,
  type BudgetService,
  type CommunicationService,
  type DarshanService,
  type DevoteeService,
  type DonationService,
  type CampaignService,
  type EventService,
  type FacilityService,
  type ExpenseService,
  type FundService,
  type GalleryService,
  type HundiService,
  type InventoryService,
  type MeetingService,
  type MemberService,
  type MembershipService,
  type OfficerService,
  type OrganizationService,
  type OverviewService,
  type PledgeService,
  type PrasadamService,
  type PujaService,
  type ReportService,
  type StatementService,
  type TaxService,
  type TempleService,
  type VendorService,
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

let _darshanService: DarshanService | undefined;

export function darshanService(): DarshanService {
  _darshanService ??= createDarshanService({ db: getDb() });
  return _darshanService;
}

let _auditService: AuditService | undefined;

export function auditService(): AuditService {
  _auditService ??= createAuditService({ db: getDb() });
  return _auditService;
}

let _officerService: OfficerService | undefined;

export function officerService(): OfficerService {
  _officerService ??= createOfficerService({ db: getDb() });
  return _officerService;
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

let _inventoryService: InventoryService | undefined;

export function inventoryService(): InventoryService {
  _inventoryService ??= createInventoryService({ db: getDb() });
  return _inventoryService;
}

let _vendorService: VendorService | undefined;

export function vendorService(): VendorService {
  _vendorService ??= createVendorService({ db: getDb() });
  return _vendorService;
}

let _communicationService: CommunicationService | undefined;

export function communicationService(): CommunicationService {
  _communicationService ??= createCommunicationService({ db: getDb() });
  return _communicationService;
}

let _statementService: StatementService | undefined;

export function statementService(): StatementService {
  _statementService ??= createStatementService({ db: getDb() });
  return _statementService;
}

let _pledgeService: PledgeService | undefined;

export function pledgeService(): PledgeService {
  _pledgeService ??= createPledgeService({ db: getDb() });
  return _pledgeService;
}

let _fundService: FundService | undefined;

export function fundService(): FundService {
  _fundService ??= createFundService({ db: getDb() });
  return _fundService;
}

let _budgetService: BudgetService | undefined;

export function budgetService(): BudgetService {
  _budgetService ??= createBudgetService({ db: getDb() });
  return _budgetService;
}

let _taxService: TaxService | undefined;

export function taxService(): TaxService {
  _taxService ??= createTaxService({ db: getDb() });
  return _taxService;
}
