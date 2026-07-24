import { z } from 'zod';

const optionalTrimmed = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === '' ? null : v))
    .nullish();

export const ASSET_CATEGORIES = [
  'jewelry',
  'vessels',
  'idols',
  'land',
  'building',
  'vehicle',
  'furniture',
  'electronics',
  'other',
] as const;
export type AssetCategory = (typeof ASSET_CATEGORIES)[number];

export const ASSET_CATEGORY_LABELS: Record<AssetCategory, string> = {
  jewelry: 'Jewellery',
  vessels: 'Vessels',
  idols: 'Idols',
  land: 'Land',
  building: 'Building',
  vehicle: 'Vehicle',
  furniture: 'Furniture',
  electronics: 'Electronics',
  other: 'Other',
};

export const assetSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(160),
  category: z.enum(ASSET_CATEGORIES),
  description: optionalTrimmed(2000),
  quantity: z.coerce
    .number()
    .int('Quantity must be a whole number')
    .min(1, 'Quantity must be at least 1')
    .max(1_000_000, 'Quantity is too large'),
  estimatedValue: z.coerce
    .number()
    .min(0, 'Value cannot be negative')
    .max(1_000_000_000_000, 'Value is too large')
    .optional(),
  acquiredOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
    .or(z.literal(''))
    .transform((v) => (v === '' ? null : v))
    .nullish(),
  location: optionalTrimmed(160),
  note: optionalTrimmed(500),
});
export type AssetInput = z.infer<typeof assetSchema>;

export const disposeAssetSchema = z.object({
  reason: z.string().trim().min(3, 'Give a short reason').max(300),
});
export type DisposeAssetInput = z.infer<typeof disposeAssetSchema>;
