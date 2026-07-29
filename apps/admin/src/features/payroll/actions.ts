'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { FormState } from '@/lib/form-state';
import { employeeService } from '@/lib/services';
import { requireTenantContext } from '@/lib/session';

function field(formData: FormData, name: string) {
  const v = formData.get(name);
  return typeof v === 'string' ? v : '';
}

function employeeInput(formData: FormData) {
  return {
    name: field(formData, 'name'),
    designation: field(formData, 'designation'),
    employmentType: field(formData, 'employmentType'),
    monthlySalary: field(formData, 'monthlySalary'),
    phone: field(formData, 'phone'),
    email: field(formData, 'email'),
    joinedOn: field(formData, 'joinedOn'),
    note: field(formData, 'note'),
  };
}

export async function createEmployeeAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { ctx } = await requireTenantContext('accounting');
  const result = await employeeService().createEmployee(ctx, employeeInput(formData));
  if (!result.ok) return { error: result.error.message };
  revalidatePath('/payroll');
  redirect(`/payroll/${result.value.id}`);
}

export async function updateEmployeeAction(
  employeeId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { ctx } = await requireTenantContext('accounting');
  const result = await employeeService().updateEmployee(ctx, employeeId, employeeInput(formData));
  if (!result.ok) return { error: result.error.message };
  revalidatePath('/payroll');
  revalidatePath(`/payroll/${employeeId}`);
  return { message: 'Saved' };
}

export async function setEmployeeActiveAction(
  employeeId: string,
  isActive: boolean,
): Promise<void> {
  const { ctx } = await requireTenantContext('accounting');
  await employeeService().setEmployeeActive(ctx, employeeId, isActive);
  revalidatePath('/payroll');
  revalidatePath(`/payroll/${employeeId}`);
}
