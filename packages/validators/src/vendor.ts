import { z } from 'zod';

const optionalTrimmed = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === '' ? null : v))
    .nullish();

const optionalEmail = z
  .string()
  .trim()
  .toLowerCase()
  .email('Enter a valid email address')
  .or(z.literal(''))
  .transform((v) => (v === '' ? null : v))
  .nullish();

const requiredDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');

const optionalDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
  .or(z.literal(''))
  .transform((v) => (v === '' ? null : v))
  .nullish();

/** Payment rails a bill can be settled through — mirrors the expense voucher methods. */
export const BILL_PAYMENT_METHODS = [
  'cash',
  'upi',
  'bank_transfer',
  'card',
  'cheque',
  'other',
] as const;
export type BillPaymentMethod = (typeof BILL_PAYMENT_METHODS)[number];

export const vendorSchema = z.object({
  name: z.string().trim().min(2, 'Enter the vendor name').max(120),
  category: optionalTrimmed(80),
  contactPerson: optionalTrimmed(120),
  phone: optionalTrimmed(20),
  email: optionalEmail,
  address: optionalTrimmed(300),
  taxId: optionalTrimmed(40),
  note: optionalTrimmed(500),
});
export type VendorInput = z.infer<typeof vendorSchema>;

export const vendorListQuerySchema = z.object({
  search: optionalTrimmed(120),
  scope: z.enum(['active', 'all']).default('active'),
});
export type VendorListQuery = z.infer<typeof vendorListQuerySchema>;

export const createBillSchema = z.object({
  billNumber: z.string().trim().min(1, 'Enter the invoice number').max(80),
  description: optionalTrimmed(200),
  amount: z.coerce
    .number()
    .positive('Amount must be greater than zero')
    .max(100_000_000, 'Amount is too large'),
  billDate: requiredDate,
  dueDate: optionalDate,
  note: optionalTrimmed(500),
});
export type CreateBillInput = z.infer<typeof createBillSchema>;

export const recordBillPaymentSchema = z.object({
  amount: z.coerce
    .number()
    .positive('Amount must be greater than zero')
    .max(100_000_000, 'Amount is too large'),
  method: z.enum(BILL_PAYMENT_METHODS),
  paidOn: optionalDate,
  reference: optionalTrimmed(120),
  note: optionalTrimmed(500),
});
export type RecordBillPaymentInput = z.infer<typeof recordBillPaymentSchema>;

export const voidBillSchema = z.object({
  reason: z.string().trim().min(3, 'Give a short reason').max(300),
});
