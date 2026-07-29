'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { InvestmentStatus } from '@templeos/core';
import type { FormState } from '@/lib/form-state';
import { investmentService } from '@/lib/services';
import { requireTenantContext } from '@/lib/session';

function field(formData: FormData, name: string) {
  const v = formData.get(name);
  return typeof v === 'string' ? v : '';
}

function investmentInput(formData: FormData) {
  return {
    institution: field(formData, 'institution'),
    type: field(formData, 'type'),
    fundId: field(formData, 'fundId'),
    reference: field(formData, 'reference'),
    principal: field(formData, 'principal'),
    interestRate: field(formData, 'interestRate'),
    investedOn: field(formData, 'investedOn'),
    maturityDate: field(formData, 'maturityDate'),
    maturityValue: field(formData, 'maturityValue'),
    note: field(formData, 'note'),
  };
}

export async function createInvestmentAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { ctx } = await requireTenantContext('accounting');
  const result = await investmentService().createInvestment(ctx, investmentInput(formData));
  if (!result.ok) return { error: result.error.message };
  revalidatePath('/investments');
  redirect(`/investments/${result.value.id}`);
}

export async function updateInvestmentAction(
  investmentId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { ctx } = await requireTenantContext('accounting');
  const result = await investmentService().updateInvestment(
    ctx,
    investmentId,
    investmentInput(formData),
  );
  if (!result.ok) return { error: result.error.message };
  revalidatePath('/investments');
  revalidatePath(`/investments/${investmentId}`);
  return { message: 'Saved' };
}

export async function setInvestmentStatusAction(
  investmentId: string,
  status: InvestmentStatus,
): Promise<void> {
  const { ctx } = await requireTenantContext('accounting');
  await investmentService().setInvestmentStatus(ctx, investmentId, status);
  revalidatePath('/investments');
  revalidatePath(`/investments/${investmentId}`);
}
