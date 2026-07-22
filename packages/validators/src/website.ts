import { z } from 'zod';

const optionalTrimmed = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === '' ? null : v))
    .nullish();

const optionalUrl = z
  .string()
  .trim()
  .url('Enter a full URL (https://…)')
  .max(300)
  .or(z.literal(''))
  .transform((v) => (v === '' ? null : v))
  .nullish();

export const siteSettingsSchema = z.object({
  tagline: optionalTrimmed(200),
  aboutText: optionalTrimmed(10_000),
  historyText: optionalTrimmed(10_000),
  contactEmail: z
    .string()
    .trim()
    .toLowerCase()
    .email('Enter a valid email address')
    .or(z.literal(''))
    .transform((v) => (v === '' ? null : v))
    .nullish(),
  contactPhone: optionalTrimmed(30),
  addressText: optionalTrimmed(500),
  facebookUrl: optionalUrl,
  instagramUrl: optionalUrl,
  youtubeUrl: optionalUrl,
});
export type SiteSettingsInput = z.infer<typeof siteSettingsSchema>;

/** Public contact form. */
export const contactMessageSchema = z
  .object({
    name: z.string().trim().min(2, 'Enter your name').max(120),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email('Enter a valid email address')
      .or(z.literal(''))
      .transform((v) => (v === '' ? null : v))
      .nullish(),
    phone: optionalTrimmed(20),
    message: z.string().trim().min(10, 'Write a few words about your enquiry').max(3000),
  })
  .refine((v) => v.email || v.phone, {
    message: 'Share an email or phone number so the temple can reply',
    path: ['email'],
  });
export type ContactMessageInput = z.infer<typeof contactMessageSchema>;
