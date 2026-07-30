'use server';

import { revalidatePath } from 'next/cache';
import { ORGANIZATION_ADMIN_STATUSES, type OrganizationAdminStatus } from '@templeos/validators';
import type { FormState } from '@/lib/form-state';
import { platformService } from '@/lib/services';
import { requirePlatformAdmin } from '@/lib/session';

function field(formData: FormData, name: string) {
  const v = formData.get(name);
  return typeof v === 'string' && v !== '' ? v : undefined;
}

export async function applyOverrideAction(
  organizationId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { user } = await requirePlatformAdmin();

  const input = {
    plan: field(formData, 'plan'),
    status: field(formData, 'status'),
    extendTrialDays: field(formData, 'extendTrialDays'),
  };

  const result = await platformService().applySubscriptionOverride(user.id, organizationId, input);
  if (!result.ok) return { error: result.error.message };

  revalidatePath(`/platform/orgs/${organizationId}`);
  revalidatePath('/platform');
  return { message: 'Applied.' };
}

function isOrgStatus(v: string): v is OrganizationAdminStatus {
  return (ORGANIZATION_ADMIN_STATUSES as readonly string[]).includes(v);
}

export async function setOrgStatusAction(organizationId: string, status: string): Promise<void> {
  const { user } = await requirePlatformAdmin();
  if (!isOrgStatus(status)) return;

  await platformService().setOrganizationStatus(user.id, organizationId, status);
  revalidatePath(`/platform/orgs/${organizationId}`);
  revalidatePath('/platform');
}
