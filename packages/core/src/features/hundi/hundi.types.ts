export interface DenominationLine {
  value: number;
  count: number;
}

export interface HundiCollectionSummary {
  id: string;
  boxName: string;
  /** 'YYYY-MM-DD' */
  countedOn: string;
  denominations: DenominationLine[] | null;
  totalAmount: string;
  currency: 'INR' | 'BDT';
  note: string | null;
  /** Receipt of the ledger entry this counting created. */
  receiptNumber: string;
  status: 'recorded' | 'void';
  createdAt: Date;
}
