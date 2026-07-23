'use client';

import { useMemo, useState } from 'react';
import { DENOMINATIONS } from '@templeos/validators';
import { Alert, Button, Input, Label, formatMoney } from '@templeos/ui';
import { useActionState } from 'react';
import { initialFormState } from '@/lib/form-state';
import { recordHundiCollectionAction } from '../actions';

interface HundiFormProps {
  currency: 'INR' | 'BDT';
}

export function HundiForm({ currency }: HundiFormProps) {
  const [state, formAction, pending] = useActionState(
    recordHundiCollectionAction,
    initialFormState,
  );
  const today = new Date().toISOString().slice(0, 10);
  const denominations = DENOMINATIONS[currency];

  const [counts, setCounts] = useState<Record<number, string>>({});

  const denomTotal = useMemo(
    () =>
      denominations.reduce((sum, value) => {
        const count = Number.parseInt(counts[value] ?? '', 10);
        return sum + (Number.isFinite(count) && count > 0 ? value * count : 0);
      }, 0),
    [counts, denominations],
  );

  return (
    <form action={formAction} className="space-y-6">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="boxName">Offering box</Label>
          <Input
            id="boxName"
            name="boxName"
            placeholder="Main Sanctum Hundi"
            required
            minLength={2}
            list="hundi-boxes"
          />
          <datalist id="hundi-boxes">
            <option value="Main Sanctum Hundi" />
            <option value="Entrance Donation Box" />
            <option value="Annadanam Box" />
          </datalist>
        </div>
        <div className="space-y-2">
          <Label htmlFor="countedOn">Counted on</Label>
          <Input id="countedOn" name="countedOn" type="date" defaultValue={today} />
        </div>
      </div>

      <div className="rounded-xl border border-border">
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
          <span className="text-sm font-medium">Count by denomination</span>
          <span className="text-xs text-muted-foreground">optional — or enter a total below</span>
        </div>
        <div className="divide-y divide-border">
          {denominations.map((value) => {
            const count = Number.parseInt(counts[value] ?? '', 10);
            const line = Number.isFinite(count) && count > 0 ? value * count : 0;
            return (
              <div key={value} className="flex items-center gap-3 px-4 py-2">
                <span className="w-20 text-sm font-medium tabular-nums">
                  {formatMoney(value, currency)}
                </span>
                <span className="text-muted-foreground">×</span>
                <Input
                  name={`denom_${value}`}
                  type="number"
                  min="0"
                  step="1"
                  inputMode="numeric"
                  placeholder="0"
                  className="w-24"
                  value={counts[value] ?? ''}
                  onChange={(e) =>
                    setCounts((prev) => ({ ...prev, [value]: e.target.value }))
                  }
                />
                <span className="ml-auto text-sm tabular-nums text-muted-foreground">
                  {line > 0 ? formatMoney(line, currency) : '—'}
                </span>
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-between border-t border-border bg-muted/40 px-4 py-3">
          <span className="text-sm font-medium">Counted total</span>
          <span className="text-lg font-semibold tabular-nums">
            {formatMoney(denomTotal, currency)}
          </span>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="amount">Or enter a total directly ({currency})</Label>
          <Input
            id="amount"
            name="amount"
            type="number"
            step="0.01"
            min="0"
            placeholder="Used only if no denominations counted"
            disabled={denomTotal > 0}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="note">Note</Label>
          <Input id="note" name="note" placeholder="Witnessed by…" />
        </div>
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? 'Recording…' : 'Record collection'}
      </Button>
    </form>
  );
}
