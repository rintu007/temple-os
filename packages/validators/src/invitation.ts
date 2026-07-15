import { z } from 'zod';

export const INVITABLE_ROLES = ['admin', 'manager', 'staff', 'viewer'] as const;
export type InvitableRole = (typeof INVITABLE_ROLES)[number];

export const createInvitationSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  roleKey: z.enum(INVITABLE_ROLES),
});
export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;
