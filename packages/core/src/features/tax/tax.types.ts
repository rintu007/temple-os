/** A tenant's 80G tax-registration identity, as printed on receipts. */
export interface TaxProfile {
  legalName: string;
  pan: string | null;
  registrationNumber: string;
  validFrom: string | null;
  validUntil: string | null;
  showOnReceipt: boolean;
}

/**
 * Everything needed to render an 80G donation receipt. The `tax` block is null
 * when the org has no profile or has turned receipt printing off, in which case
 * the receipt still renders as a plain acknowledgement.
 */
export interface Receipt80G {
  receiptNumber: string;
  donatedOn: Date;
  financialYearLabel: string;
  donorName: string;
  donorPan: string | null;
  amount: string;
  currency: 'INR' | 'BDT';
  method: string;
  categoryName: string | null;
  isVoid: boolean;
  organizationName: string;
  tax: TaxProfile | null;
}
