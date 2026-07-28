import { z } from 'zod';

/** The 4 system roles an owner/admin can hand out — 'owner' itself is excluded. */
export const INVITABLE_SYSTEM_ROLES = ['admin', 'manager', 'staff', 'viewer'] as const;
export type InvitableSystemRole = (typeof INVITABLE_SYSTEM_ROLES)[number];

export const createInvitationSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  // Any system role (except owner) or a custom role key — the repository
  // resolves it against this org's roles and rejects an unknown one.
  roleKey: z.string().trim().min(1, 'Choose a role'),
});
export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;
