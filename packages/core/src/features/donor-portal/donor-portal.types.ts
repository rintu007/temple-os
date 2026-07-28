import type { Receipt80G } from '../tax/tax.types';

/** A signed-in devotee's identity, resolved from a portal session token. */
export interface PortalSession {
  organizationId: string;
  devoteeId: string;
  devoteeName: string;
}

export interface PortalDonation {
  id: string;
  receiptNumber: string;
  amount: string;
  currency: string;
  method: string;
  categoryName: string | null;
  donatedAt: Date;
  status: string;
}

export interface PortalDonationPage {
  items: PortalDonation[];
  total: number;
}

export interface PortalGivingSummary {
  currency: string;
  lifetimeTotal: string;
  lifetimeCount: number;
  fyTotal: string;
  fyCount: number;
  fyLabel: string;
  recent: PortalDonation[];
}

export type PortalReceipt = Receipt80G;
