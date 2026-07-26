'use client';

import { useActionState } from 'react';
import type { InKindSummary } from '@templeos/core';
import { Alert, Button, Input, Label, Select } from '@templeos/ui';
import { initialFormState } from '@/lib/form-state';
import { setDispositionAction } from '../actions';

const DISPOSITIONS = [
  { value: 'in_stock', label: 'In stock' },
  { value: 'sold', label: 'Sold' },
  { value: 'used', label: 'Used' },
  { value: 'returned', label: 'Returned' },
];

export function DispositionForm({ offering }: { offering: InKindSummary }) {
  const [state, formAction, pending] = useActionState(
    setDispositionAction.bind(null, offering.id),
    initialFormState,
  );

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.message ? <Alert tone="success">{state.message}</Alert> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="disposition">Disposition</Label>
          <Select id="disposition" name="disposition" defaultValue={offering.disposition}>
            {DISPOSITIONS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="disposalNote">Note</Label>
          <Input
            id="disposalNote"
            name="disposalNote"
            defaultValue={offering.disposalNote ?? ''}
            placeholder="e.g. Melted into temple crown"
          />
        </div>
      </div>

      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        {pending ? 'Saving…' : 'Update disposition'}
      </Button>
    </form>
  );
}
