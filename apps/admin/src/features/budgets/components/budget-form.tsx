'use client';

import { useActionState } from 'react';
import { Alert, Button, Input, Label, Select } from '@templeos/ui';
import { initialFormState } from '@/lib/form-state';
import { setBudgetAction } from '../actions';

interface BudgetFormProps {
  financialYear: number;
  categories: string[];
}

export function BudgetForm({ financialYear, categories }: BudgetFormProps) {
  const [state, formAction, pending] = useActionState(setBudgetAction, initialFormState);

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.message ? <Alert tone="success">{state.message}</Alert> : null}
      <input type="hidden" name="financialYear" value={financialYear} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="kind">Side</Label>
          <Select id="kind" name="kind" defaultValue="income">
            <option value="income">Income</option>
            <option value="expense">Expenditure</option>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="category">Category</Label>
          <Input id="category" name="category" list="budget-categories" required maxLength={120} />
          <datalist id="budget-categories">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
        <div className="space-y-2">
          <Label htmlFor="amount">Budgeted amount</Label>
          <Input
            id="amount"
            name="amount"
            type="number"
            step="0.01"
            min="0"
            required
            inputMode="decimal"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="note">Note</Label>
          <Input id="note" name="note" maxLength={300} />
        </div>
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? 'Saving…' : 'Set budget'}
      </Button>
      <p className="text-xs text-muted-foreground">
        Setting a budget for a category that already has one updates it.
      </p>
    </form>
  );
}
