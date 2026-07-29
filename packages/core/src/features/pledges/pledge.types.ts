export type PledgeProgress = 'unfulfilled' | 'partial' | 'fulfilled';

export interface PledgeSummary {
  id: string;
  donorName: string;
  devoteeId: string | null;
  campaignId: string | null;
  campaignTitle: string | null;
  amount: string;
  currency: 'INR' | 'BDT' | 'USD' | 'GBP' | 'CAD' | 'AUD';
  pledgedOn: string;
  dueDate: string | null;
  note: string | null;
  status: 'open' | 'cancelled';
  cancelReason: string | null;
  /** Derived — sum of recorded donations linked to this pledge. */
  received: string;
  outstanding: string;
  progress: PledgeProgress;
  isOverdue: boolean;
}

export interface PledgeFulfilment {
  id: string;
  receiptNumber: string;
  amount: string;
  method: string;
  donatedAt: Date;
}

export interface PledgeDetail {
  pledge: PledgeSummary;
  fulfilments: PledgeFulfilment[];
}

export interface PledgeStats {
  currency: 'INR' | 'BDT' | 'USD' | 'GBP' | 'CAD' | 'AUD';
  totalPledged: string;
  totalOutstanding: string;
  overdueOutstanding: string;
  openCount: number;
}
