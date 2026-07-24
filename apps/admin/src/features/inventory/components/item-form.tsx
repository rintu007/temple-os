'use client';

import { useActionState } from 'react';
import { INVENTORY_UNITS, INVENTORY_UNIT_LABELS } from '@templeos/validators';
import { Alert, Button, Input, Label, Select } from '@templeos/ui';
import { initialFormState, type FormState } from '@/lib/form-state';

interface ItemDefaults {
  name: string;
  category: string;
  unit: string;
  reorderLevel: string;
  note: string;
}

interface ItemFormProps {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  submitLabel: string;
  defaults?: ItemDefaults;
}

export function ItemForm({ action, submitLabel, defaults }: ItemFormProps) {
  const [state, formAction, pending] = useActionState(action, initialFormState);

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.message ? <Alert tone="success">{state.message}</Alert> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="name">Item name</Label>
          <Input
            id="name"
            name="name"
            placeholder="Ghee"
            required
            minLength={2}
            defaultValue={defaults?.name}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="category">Category</Label>
          <Input
            id="category"
            name="category"
            placeholder="Kitchen / Pooja supplies"
            list="inv-categories"
            defaultValue={defaults?.category}
          />
          <datalist id="inv-categories">
            <option value="Prasadam kitchen" />
            <option value="Pooja supplies" />
            <option value="Cleaning" />
            <option value="Office" />
          </datalist>
        </div>
        <div className="space-y-2">
          <Label htmlFor="unit">Unit</Label>
          <Select id="unit" name="unit" defaultValue={defaults?.unit ?? 'kg'} required>
            {INVENTORY_UNITS.map((u) => (
              <option key={u} value={u}>
                {INVENTORY_UNIT_LABELS[u]}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="reorderLevel">Reorder level</Label>
          <Input
            id="reorderLevel"
            name="reorderLevel"
            type="number"
            min="0"
            step="0.001"
            placeholder="Alert when at or below"
            defaultValue={defaults?.reorderLevel}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="note">Note</Label>
          <Input id="note" name="note" defaultValue={defaults?.note} />
        </div>
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? 'Saving…' : submitLabel}
      </Button>
    </form>
  );
}
