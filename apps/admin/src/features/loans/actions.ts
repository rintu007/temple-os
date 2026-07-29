'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { LoanStatus } from '@templeos/core';
import type { FormState } from '@/lib/form-state';
import { loanService } from '@/lib/services';
import { requireTenantContext } from '@/lib/session';

function field(formData: FormData, name: string) {
  const v = formData.get(name);
  return typeof v === 'string' ? v : '';
}

function loanInput(formData: FormData) {
  return {
    direction: field(formData, 'direction'),
    counterparty: field(formData, 'counterparty'),
    employeeId: field(formData, 'employeeId'),
    title: field(formData, 'title'),
    principal: field(formData, 'principal'),
    interestRate: field(formData, 'interestRate'),
    disbursedOn: field(formData, 'disbursedOn'),
    dueOn: field(formData, 'dueOn'),
    note: field(formData, 'note'),
  };
}

export async function createLoanAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { ctx } = await requireTenantContext('accounting');
  const result = await loanService().createLoan(ctx, loanInput(formData));
  if (!result.ok) return { error: result.error.message };
  revalidatePath('/loans');
  redirect(`/loans/${result.value.id}`);
}

export async function updateLoanAction(
  loanId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { ctx } = await requireTenantContext('accounting');
  const result = await loanService().updateLoan(ctx, loanId, loanInput(formData));
  if (!result.ok) return { error: result.error.message };
  revalidatePath('/loans');
  revalidatePath(`/loans/${loanId}`);
  return { message: 'Saved' };
}

export async function recordRepaymentAction(
  loanId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { ctx } = await requireTenantContext('accounting');
  const result = await loanService().recordRepayment(ctx, loanId, {
    amount: field(formData, 'amount'),
    paidOn: field(formData, 'paidOn'),
    note: field(formData, 'note'),
  });
  if (!result.ok) return { error: result.error.message };
  revalidatePath('/loans');
  revalidatePath(`/loans/${loanId}`);
  return { message: 'Repayment recorded.' };
}

export async function setLoanStatusAction(loanId: string, status: LoanStatus): Promise<void> {
  const { ctx } = await requireTenantContext('accounting');
  await loanService().setLoanStatus(ctx, loanId, status);
  revalidatePath('/loans');
  revalidatePath(`/loans/${loanId}`);
}
