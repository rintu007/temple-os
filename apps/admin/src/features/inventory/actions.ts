'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { FormState } from '@/lib/form-state';
import { inventoryService } from '@/lib/services';
import { requireTenantContext } from '@/lib/session';

function itemInputFromForm(formData: FormData) {
  const field = (name: string) => {
    const v = formData.get(name);
    return typeof v === 'string' ? v : '';
  };
  const reorderLevel = field('reorderLevel');
  return {
    name: field('name'),
    category: field('category'),
    unit: field('unit'),
    reorderLevel: reorderLevel === '' ? undefined : reorderLevel,
    note: field('note'),
  };
}

export async function createItemAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { ctx } = await requireTenantContext();
  const result = await inventoryService().createItem(ctx, itemInputFromForm(formData));
  if (!result.ok) return { error: result.error.message };
  revalidatePath('/inventory');
  redirect(`/inventory/${result.value.id}`);
}

export async function updateItemAction(
  itemId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { ctx } = await requireTenantContext();
  const result = await inventoryService().updateItem(ctx, itemId, itemInputFromForm(formData));
  if (!result.ok) return { error: result.error.message };
  revalidatePath('/inventory');
  revalidatePath(`/inventory/${itemId}`);
  return { message: 'Saved' };
}

export async function recordMovementAction(
  itemId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { ctx } = await requireTenantContext();
  const field = (name: string) => {
    const v = formData.get(name);
    return typeof v === 'string' ? v : '';
  };
  const result = await inventoryService().recordMovement(ctx, itemId, {
    kind: field('kind'),
    quantity: field('quantity'),
    note: field('note'),
  });
  if (!result.ok) return { error: result.error.message };
  revalidatePath('/inventory');
  revalidatePath(`/inventory/${itemId}`);
  return { message: `Stock updated — now ${result.value.currentStock} ${result.value.unit}` };
}
