import { z } from 'zod';
import type { TenantContext } from '@templeos/core';

/**
 * Custom claims injected by the Supabase Custom Access Token Hook for the
 * user's active organization. The JWT is the ONLY trusted source of tenant
 * identity — never accept an organization id from client input.
 */
export const tenantClaimsSchema = z.object({
  org_id: z.string().uuid(),
  role_key: z.string().min(1),
  temple_ids: z.array(z.string().uuid()).nullable().default(null),
});

export type TenantClaims = z.infer<typeof tenantClaimsSchema>;

export function tenantContextFromClaims(
  userId: string,
  rawClaims: unknown,
): TenantContext | null {
  const parsed = tenantClaimsSchema.safeParse(rawClaims);
  if (!parsed.success) return null;
  return {
    organizationId: parsed.data.org_id,
    userId,
    roleKey: parsed.data.role_key,
    templeIds: parsed.data.temple_ids,
  };
}
