'use client';

import { useActionState } from 'react';
import { Alert, Button, Input, Label, Select } from '@templeos/ui';
import { initialFormState } from '@/lib/form-state';
import { recordExpenseAction } from '../actions';

interface ExpenseFormProps {
  currency: string;
  funds?: Array<{ id: string; name: string }>;
}

const METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'card', label: 'Card' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'other', label: 'Other' },
];

export function ExpenseForm({ currency, funds = [] }: ExpenseFormProps) {
  const [state, formAction, pending] = useActionState(recordExpenseAction, initialFormState);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="amount">Amount ({currency})</Label>
          <Input
            id="amount"
            name="amount"
            type="number"
            step="0.01"
            min="1"
            placeholder="1500.00"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="method">Payment method</Label>
          <Select id="method" name="method" defaultValue="cash" required>
            {METHODS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="paidTo">Paid to</Label>
          <Input
            id="paidTo"
            name="paidTo"
            placeholder="Vendor, shop or person paid"
            required
            minLength={2}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="categoryName">Category</Label>
          <Input
            id="categoryName"
            name="categoryName"
            placeholder="Puja Supplies"
            list="expense-categories"
          />
          <datalist id="expense-categories">
            <option value="Puja Supplies" />
            <option value="Prasad & Annadanam" />
            <option value="Salaries & Dakshina" />
            <option value="Electricity & Utilities" />
            <option value="Repairs & Maintenance" />
            <option value="Festival Expenses" />
            <option value="Office & Misc" />
          </datalist>
        </div>
        <div className="space-y-2">
          <Label htmlFor="spentOn">Date</Label>
          <Input id="spentOn" name="spentOn" type="date" defaultValue={today} />
        </div>

        {funds.length > 0 ? (
          <div className="space-y-2">
            <Label htmlFor="fundId">Fund (optional)</Label>
            <Select id="fundId" name="fundId" defaultValue="">
              <option value="">— General —</option>
              {funds.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </Select>
          </div>
        ) : null}
        <div className="space-y-2">
          <Label htmlFor="reference">Reference (bill/cheque no.)</Label>
          <Input id="reference" name="reference" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="note">Note</Label>
          <Input id="note" name="note" />
        </div>
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? 'Recording…' : 'Record expense'}
      </Button>
    </form>
  );
}
