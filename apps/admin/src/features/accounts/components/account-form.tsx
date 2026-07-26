'use client';

import { useActionState, useState } from 'react';
import type { AccountSummary } from '@templeos/core';
import { Alert, Button, Input, Label, Select, Textarea } from '@templeos/ui';
import { initialFormState, type FormState } from '@/lib/form-state';

interface AccountFormProps {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  account?: AccountSummary & { openingDate?: string | null };
  currency: string;
  submitLabel: string;
}

export function AccountForm({ action, account, currency, submitLabel }: AccountFormProps) {
  const [state, formAction, pending] = useActionState(action, initialFormState);
  const [type, setType] = useState<'bank' | 'cash'>(account?.type ?? 'bank');
  const isBank = type === 'bank';

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.message ? <Alert tone="success">{state.message}</Alert> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">Account name</Label>
          <Input
            id="name"
            name="name"
            defaultValue={account?.name}
            required
            minLength={2}
            placeholder="SBI Current, Cash box…"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="type">Type</Label>
          <Select
            id="type"
            name="type"
            value={type}
            onChange={(e) => setType(e.target.value as 'bank' | 'cash')}
          >
            <option value="bank">Bank account</option>
            <option value="cash">Cash box</option>
          </Select>
        </div>

        {isBank ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="bankName">Bank name</Label>
              <Input
                id="bankName"
                name="bankName"
                defaultValue={account?.bankName ?? ''}
                placeholder="State Bank of India"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="accountNumber">Account number</Label>
              <Input
                id="accountNumber"
                name="accountNumber"
                defaultValue=""
                placeholder={account?.accountNumberMasked ?? '00000000000000'}
                maxLength={40}
              />
              {account?.accountNumberMasked ? (
                <p className="text-xs text-muted-foreground">
                  Currently {account.accountNumberMasked}. Leave blank to keep, or re-enter to
                  change.
                </p>
              ) : null}
            </div>
          </>
        ) : (
          <input type="hidden" name="bankName" value="" />
        )}

        <div className="space-y-2">
          <Label htmlFor="openingBalance">Opening balance ({currency})</Label>
          <Input
            id="openingBalance"
            name="openingBalance"
            type="number"
            step="0.01"
            defaultValue={account?.openingBalance ?? '0.00'}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="openingDate">As on date</Label>
          <Input
            id="openingDate"
            name="openingDate"
            type="date"
            defaultValue={account?.openingDate ?? ''}
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
