'use client';

import { useActionState } from 'react';
import { ASSET_CATEGORIES, ASSET_CATEGORY_LABELS } from '@templeos/validators';
import { Alert, Button, Input, Label, Select, Textarea } from '@templeos/ui';
import { initialFormState, type FormState } from '@/lib/form-state';

interface AssetDefaults {
  name: string;
  category: string;
  description: string;
  quantity: number;
  estimatedValue: string;
  acquiredOn: string;
  location: string;
  note: string;
}

interface AssetFormProps {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  currency: string;
  submitLabel: string;
  defaults?: AssetDefaults;
}

export function AssetForm({ action, currency, submitLabel, defaults }: AssetFormProps) {
  const [state, formAction, pending] = useActionState(action, initialFormState);

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.message ? <Alert tone="success">{state.message}</Alert> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            name="name"
            placeholder="Gold crown (kireetam)"
            required
            minLength={2}
            defaultValue={defaults?.name}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="category">Category</Label>
          <Select id="category" name="category" defaultValue={defaults?.category ?? 'jewelry'} required>
            {ASSET_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {ASSET_CATEGORY_LABELS[c]}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="quantity">Quantity</Label>
          <Input
            id="quantity"
            name="quantity"
            type="number"
            min="1"
            step="1"
            defaultValue={defaults?.quantity ?? 1}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="estimatedValue">Estimated value ({currency}, each)</Label>
          <Input
            id="estimatedValue"
            name="estimatedValue"
            type="number"
            min="0"
            step="0.01"
            placeholder="Optional"
            defaultValue={defaults?.estimatedValue}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="acquiredOn">Acquired on</Label>
          <Input id="acquiredOn" name="acquiredOn" type="date" defaultValue={defaults?.acquiredOn} />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="location">Location / custody</Label>
          <Input
            id="location"
            name="location"
            placeholder="Strong room, locker 3"
            defaultValue={defaults?.location}
          />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            name="description"
            rows={2}
            placeholder="Weight, hallmark, distinguishing marks…"
            defaultValue={defaults?.description}
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
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
