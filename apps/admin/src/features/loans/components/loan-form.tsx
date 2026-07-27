'use client';

import { useActionState, useState } from 'react';
import type { LoanSummary } from '@templeos/core';
import { Alert, Button, Input, Label, Select, Textarea } from '@templeos/ui';
import { initialFormState, type FormState } from '@/lib/form-state';

interface LoanFormProps {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  loan?: LoanSummary;
  currency: string;
  employees: Array<{ id: string; name: string }>;
  submitLabel: string;
}

export function LoanForm({ action, loan, currency, employees, submitLabel }: LoanFormProps) {
  const [state, formAction, pending] = useActionState(action, initialFormState);
  const [direction, setDirection] = useState<'given' | 'taken'>(loan?.direction ?? 'given');

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.message ? <Alert tone="success">{state.message}</Alert> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="direction">Type</Label>
          <Select
            id="direction"
            name="direction"
            value={direction}
            onChange={(e) => setDirection(e.target.value as 'given' | 'taken')}
          >
            <option value="given">Given — money we lent (receivable)</option>
            <option value="taken">Taken — money we borrowed (payable)</option>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="counterparty">
            {direction === 'given' ? 'Borrower' : 'Lender'}
          </Label>
          <Input
            id="counterparty"
            name="counterparty"
            defaultValue={loan?.counterparty}
            required
            minLength={2}
            placeholder={direction === 'given' ? 'Ramesh (Cook), affiliated trust…' : 'City Co-op Bank…'}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="principal">Principal ({currency})</Label>
          <Input
            id="principal"
            name="principal"
            type="number"
            step="0.01"
            min="0"
            defaultValue={loan?.principal}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="interestRate">Interest rate % p.a. (optional)</Label>
          <Input
            id="interestRate"
            name="interestRate"
            type="number"
            step="0.001"
            min="0"
            defaultValue={loan?.interestRate ?? ''}
            placeholder="0 = interest-free"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="disbursedOn">Disbursed on</Label>
          <Input
            id="disbursedOn"
            name="disbursedOn"
            type="date"
            defaultValue={loan?.disbursedOn ?? ''}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="dueOn">Due by (optional)</Label>
          <Input id="dueOn" name="dueOn" type="date" defaultValue={loan?.dueOn ?? ''} />
        </div>
        {employees.length > 0 ? (
          <div className="space-y-2">
            <Label htmlFor="employeeId">Link to staff (advance)</Label>
            <Select id="employeeId" name="employeeId" defaultValue={loan?.employeeId ?? ''}>
              <option value="">— Not a staff advance —</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </Select>
          </div>
        ) : null}
        <div className="space-y-2">
          <Label htmlFor="title">Purpose (optional)</Label>
          <Input
            id="title"
            name="title"
            defaultValue={loan?.title ?? ''}
            placeholder="Festival advance, vehicle loan…"
          />
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
