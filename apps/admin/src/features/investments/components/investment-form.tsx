'use client';

import { useActionState } from 'react';
import type { InvestmentSummary } from '@templeos/core';
import { Alert, Button, Input, Label, Select, Textarea } from '@templeos/ui';
import { initialFormState, type FormState } from '@/lib/form-state';

const TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'fixed_deposit', label: 'Fixed deposit' },
  { value: 'recurring_deposit', label: 'Recurring deposit' },
  { value: 'bond', label: 'Bond' },
  { value: 'mutual_fund', label: 'Mutual fund' },
  { value: 'other', label: 'Other' },
];

interface InvestmentFormProps {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  investment?: InvestmentSummary;
  currency: string;
  funds: Array<{ id: string; name: string }>;
  submitLabel: string;
}

export function InvestmentForm({
  action,
  investment,
  currency,
  funds,
  submitLabel,
}: InvestmentFormProps) {
  const [state, formAction, pending] = useActionState(action, initialFormState);

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.message ? <Alert tone="success">{state.message}</Alert> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="institution">Institution</Label>
          <Input
            id="institution"
            name="institution"
            defaultValue={investment?.institution}
            required
            minLength={2}
            placeholder="State Bank of India, Post Office…"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="type">Type</Label>
          <Select id="type" name="type" defaultValue={investment?.type ?? 'fixed_deposit'}>
            {TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="principal">Principal ({currency})</Label>
          <Input
            id="principal"
            name="principal"
            type="number"
            step="0.01"
            min="0"
            defaultValue={investment?.principal}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="maturityValue">Maturity value ({currency}, optional)</Label>
          <Input
            id="maturityValue"
            name="maturityValue"
            type="number"
            step="0.01"
            min="0"
            defaultValue={investment?.maturityValue ?? ''}
            placeholder="As printed on the receipt"
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
            defaultValue={investment?.interestRate ?? ''}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="reference">FD / folio number (optional)</Label>
          <Input id="reference" name="reference" defaultValue={investment?.reference ?? ''} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="investedOn">Invested on</Label>
          <Input
            id="investedOn"
            name="investedOn"
            type="date"
            defaultValue={investment?.investedOn ?? ''}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="maturityDate">Maturity date (optional)</Label>
          <Input
            id="maturityDate"
            name="maturityDate"
            type="date"
            defaultValue={investment?.maturityDate ?? ''}
          />
        </div>
        {funds.length > 0 ? (
          <div className="space-y-2">
            <Label htmlFor="fundId">Belongs to fund (optional)</Label>
            <Select id="fundId" name="fundId" defaultValue={investment?.fundId ?? ''}>
              <option value="">— No specific fund —</option>
              {funds.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </Select>
          </div>
        ) : null}
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
