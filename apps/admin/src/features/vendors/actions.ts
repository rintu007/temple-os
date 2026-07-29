'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { FormState } from '@/lib/form-state';
import { vendorService } from '@/lib/services';
import { requireTenantContext } from '@/lib/session';

function field(formData: FormData, name: string) {
  const v = formData.get(name);
  return typeof v === 'string' ? v : '';
}

function vendorInputFromForm(formData: FormData) {
  return {
    name: field(formData, 'name'),
    category: field(formData, 'category'),
    contactPerson: field(formData, 'contactPerson'),
    phone: field(formData, 'phone'),
    email: field(formData, 'email'),
    address: field(formData, 'address'),
    taxId: field(formData, 'taxId'),
    note: field(formData, 'note'),
  };
}

export async function createVendorAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { ctx } = await requireTenantContext('accounting');
  const result = await vendorService().createVendor(ctx, vendorInputFromForm(formData));
  if (!result.ok) return { error: result.error.message };
  revalidatePath('/vendors');
  redirect(`/vendors/${result.value.id}`);
}

export async function updateVendorAction(
  vendorId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { ctx } = await requireTenantContext('accounting');
  const result = await vendorService().updateVendor(ctx, vendorId, vendorInputFromForm(formData));
  if (!result.ok) return { error: result.error.message };
  revalidatePath('/vendors');
  revalidatePath(`/vendors/${vendorId}`);
  return { message: 'Saved' };
}

export async function setVendorActiveAction(vendorId: string, isActive: boolean): Promise<void> {
  const { ctx } = await requireTenantContext('accounting');
  await vendorService().setVendorActive(ctx, vendorId, isActive);
  revalidatePath('/vendors');
  revalidatePath(`/vendors/${vendorId}`);
}

export async function createBillAction(
  vendorId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { ctx } = await requireTenantContext('accounting');
  const result = await vendorService().createBill(ctx, vendorId, {
    billNumber: field(formData, 'billNumber'),
    description: field(formData, 'description'),
    amount: field(formData, 'amount'),
    billDate: field(formData, 'billDate'),
    dueDate: field(formData, 'dueDate'),
    note: field(formData, 'note'),
  });
  if (!result.ok) return { error: result.error.message };
  revalidatePath(`/vendors/${vendorId}`);
  revalidatePath('/vendors');
  return { message: 'Bill added' };
}

export async function recordPaymentAction(
  vendorId: string,
  billId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { ctx } = await requireTenantContext('accounting');
  const result = await vendorService().recordPayment(ctx, billId, {
    amount: field(formData, 'amount'),
    method: field(formData, 'method'),
    paidOn: field(formData, 'paidOn'),
    reference: field(formData, 'reference'),
    note: field(formData, 'note'),
  });
  if (!result.ok) return { error: result.error.message };
  revalidatePath(`/vendors/${vendorId}`);
  revalidatePath('/vendors');
  revalidatePath('/expenses');
  return { message: `Recorded — voucher ${result.value.voucherNumber}` };
}

export async function voidBillAction(vendorId: string, billId: string): Promise<void> {
  const { ctx } = await requireTenantContext('accounting');
  await vendorService().voidBill(ctx, billId, { reason: 'Voided from vendor register' });
  revalidatePath(`/vendors/${vendorId}`);
  revalidatePath('/vendors');
}
