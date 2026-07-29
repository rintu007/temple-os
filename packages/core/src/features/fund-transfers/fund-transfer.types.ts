export interface FundTransferSummary {
  id: string;
  fromFundId: string;
  fromFundName: string;
  toFundId: string;
  toFundName: string;
  amount: string;
  transferredOn: string;
  reference: string | null;
  note: string | null;
}

export interface FundTransferStats {
  currency: 'INR' | 'BDT' | 'USD' | 'GBP' | 'CAD' | 'AUD';
  count: number;
  total: string;
}
