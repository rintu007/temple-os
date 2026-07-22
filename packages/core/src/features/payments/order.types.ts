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
}
