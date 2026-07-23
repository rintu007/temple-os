/** Provider-specific checkout hand-off. Razorpay opens an in-page modal; SSLCommerz redirects. */
export type DonationOrder =
  | {
      kind: 'razorpay';
      orderId: string;
      /** Integer paise */
      amountPaise: number;
      currency: 'INR';
      keyId: string;
    }
  | {
      kind: 'sslcommerz';
      gatewayUrl: string;
    };

export interface ConfirmedDonation {
  receiptNumber: string;
  amount: string;
  currency: 'INR' | 'BDT';
  donorName: string;
  /** Donor email captured at order time — for receipt emails on server-side confirms. */
  email: string | null;
  /** True when this confirm was a no-op because another path (client confirm
   *  or webhook) already recorded the payment — callers skip the receipt email. */
  alreadyPaid: boolean;
}
