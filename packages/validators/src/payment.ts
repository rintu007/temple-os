import { z } from 'zod';

const optionalTrimmed = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === '' ? null : v))
    .nullish();

export const createDonationOrderSchema = z.object({
  amount: z.coerce
    .number()
    .positive('Enter an amount greater than zero')
    .max(10_000_000, 'Amount is too large'),
  donorName: z.string().trim().min(2, 'Enter your name').max(120),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Enter a valid email address')
    .or(z.literal(''))
    .transform((v) => (v === '' ? null : v))
    .nullish(),
  phone: optionalTrimmed(20),
  categoryName: optionalTrimmed(120),
});
export type CreateDonationOrderInput = z.infer<typeof createDonationOrderSchema>;

export const confirmDonationOrderSchema = z.object({
  providerOrderId: z.string().min(1),
  providerPaymentId: z.string().min(1),
  signature: z.string().min(1),
});
export type ConfirmDonationOrderInput = z.infer<typeof confirmDonationOrderSchema>;

/** SSLCommerz redirect callback — the val_id we validate server-side. */
export const confirmSslcommerzSchema = z.object({
  valId: z.string().trim().min(5).max(120),
});
export type ConfirmSslcommerzInput = z.infer<typeof confirmSslcommerzSchema>;
