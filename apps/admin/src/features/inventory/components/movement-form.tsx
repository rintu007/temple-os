'use client';

import { useActionState } from 'react';
import { Alert, Button, Input, Label, Select } from '@templeos/ui';
import { initialFormState } from '@/lib/form-state';
import { recordMovementAction } from '../actions';

export function MovementForm({ itemId, unit }: { itemId: string; unit: string }) {
  const [state, formAction, pending] = useActionState(
    recordMovementAction.bind(null, itemId),
    initialFormState,
  );

  return (
    <form action={formAction} className="space-y-3">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.message ? <Alert tone="success">{state.message}</Alert> : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="kind">Movement</Label>
          <Select id="kind" name="kind" defaultValue="in">
            <option value="in">Stock in</option>
            <option value="out">Issue / use</option>
            <option value="adjust">Set count (stock-take)</option>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="quantity">Quantity ({unit})</Label>
          <Input id="quantity" name="quantity" type="number" min="0" step="0.001" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="note">Note</Label>
          <Input id="note" name="note" placeholder="Optional" />
        </div>
      </div>

      <Button type="submit" size="sm" disabled={pending}>
        {pending ? 'Recording…' : 'Record movement'}
      </Button>
    </form>
  );
}
