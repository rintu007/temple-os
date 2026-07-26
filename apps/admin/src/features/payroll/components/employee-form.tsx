'use client';

import { useActionState } from 'react';
import type { EmployeeSummary } from '@templeos/core';
import { Alert, Button, Input, Label, Select, Textarea } from '@templeos/ui';
import { initialFormState, type FormState } from '@/lib/form-state';

const TYPES = [
  { value: 'salaried', label: 'Salaried staff' },
  { value: 'priest', label: 'Priest' },
  { value: 'wage', label: 'Daily wage' },
  { value: 'honorary', label: 'Honorary / stipend' },
];

interface EmployeeFormProps {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  employee?: EmployeeSummary;
  currency: string;
  submitLabel: string;
}

export function EmployeeForm({ action, employee, currency, submitLabel }: EmployeeFormProps) {
  const [state, formAction, pending] = useActionState(action, initialFormState);

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.message ? <Alert tone="success">{state.message}</Alert> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" defaultValue={employee?.name} required minLength={2} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="designation">Designation</Label>
          <Input
            id="designation"
            name="designation"
            defaultValue={employee?.designation ?? ''}
            placeholder="Head Priest, Cook…"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="employmentType">Type</Label>
          <Select
            id="employmentType"
            name="employmentType"
            defaultValue={employee?.employmentType ?? 'salaried'}
          >
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="monthlySalary">Monthly salary ({currency})</Label>
          <Input
            id="monthlySalary"
            name="monthlySalary"
            type="number"
            step="0.01"
            min="0"
            defaultValue={employee?.monthlySalary ?? ''}
            placeholder="Optional"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" name="phone" defaultValue={employee?.phone ?? ''} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" defaultValue={employee?.email ?? ''} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="joinedOn">Joined on</Label>
          <Input id="joinedOn" name="joinedOn" type="date" defaultValue={employee?.joinedOn ?? ''} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="note">Note</Label>
        <Textarea id="note" name="note" rows={2} />
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? 'Saving…' : submitLabel}
      </Button>
    </form>
  );
}
