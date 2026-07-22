export interface DonationOrder {
  orderId: string;
  /** Integer paise */
  amountPaise: number;
  currency: 'INR';
  keyId: string;
}

export interface ConfirmedDonation {
  receiptNumber: string;
  amount: string;
  currency: 'INR' | 'BDT';
  donorName: string;
  /** True when this confirm was a no-op because another path (client confirm
   *  or webhook) already recorded the payment — callers skip the receipt email. */
  alreadyPaid: boolean;
}
