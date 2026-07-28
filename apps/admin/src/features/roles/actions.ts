'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { FormState } from '@/lib/form-state';
import { roleService } from '@/lib/services';
import { requireTenantContext } from '@/lib/session';

function roleInput(formData: FormData) {
  return {
    name: formData.get('name'),
    permissionKeys: formData.getAll('permissionKeys'),
  };
}

export async function createRoleAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { ctx } = await requireTenantContext();
  const result = await roleService().createRole(ctx, roleInput(formData));
  if (!result.ok) return { error: result.error.message };
  revalidatePath('/team/roles');
  redirect(`/team/roles/${result.value.id}`);
}

export async function updateRoleAction(
  roleId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { ctx } = await requireTenantContext();
  const result = await roleService().updateRole(ctx, roleId, roleInput(formData));
  if (!result.ok) return { error: result.error.message };
  revalidatePath('/team/roles');
  revalidatePath(`/team/roles/${roleId}`);
  return { message: 'Saved' };
}

export async function deleteRoleAction(roleId: string): Promise<void> {
  const { ctx } = await requireTenantContext();
  await roleService().deleteRole(ctx, roleId);
  revalidatePath('/team/roles');
}
