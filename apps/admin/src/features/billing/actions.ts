'use server';

import { redirect } from 'next/navigation';
import { billingService } from '@/lib/services';
import { requireTenantContext } from '@/lib/session';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

export async function upgradeToProAction(): Promise<void> {
  const { ctx } = await requireTenantContext();
  const result = await billingService().createUpgradeCheckout(ctx, APP_URL);
  if (!result.ok) return;
  redirect(result.value.gatewayUrl);
}

export async function manageBillingAction(): Promise<void> {
  const { ctx } = await requireTenantContext();
  const result = await billingService().createPortalSession(ctx, APP_URL);
  if (!result.ok) return;
  redirect(result.value.gatewayUrl);
}
