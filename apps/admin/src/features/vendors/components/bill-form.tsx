'use client';

import { useActionState } from 'react';
import { Alert, Button, Input, Label, Textarea } from '@templeos/ui';
import { initialFormState, type FormState } from '@/lib/form-state';

interface BillFormProps {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
}

export function BillForm({ action }: BillFormProps) {
  const [state, formAction, pending] = useActionState(action, initialFormState);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.message ? <Alert tone="success">{state.message}</Alert> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="billNumber">Invoice number</Label>
          <Input id="billNumber" name="billNumber" required placeholder="INV-1001" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="amount">Amount</Label>
          <Input
            id="amount"
            name="amount"
            type="number"
            step="0.01"
            min="0.01"
            required
            inputMode="decimal"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="billDate">Bill date</Label>
          <Input id="billDate" name="billDate" type="date" required defaultValue={today} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="dueDate">Due date</Label>
          <Input id="dueDate" name="dueDate" type="date" />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="description">Description</Label>
          <Input id="description" name="description" placeholder="What is this bill for?" />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="note">Note</Label>
          <Textarea id="note" name="note" rows={2} />
        </div>
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? 'Adding…' : 'Add bill'}
      </Button>
    </form>
  );
}
