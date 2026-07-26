'use client';

import { useActionState } from 'react';
import type { InKindSummary } from '@templeos/core';
import { Alert, Button, Input, Label, Select, Textarea } from '@templeos/ui';
import { initialFormState, type FormState } from '@/lib/form-state';

const CATEGORIES = [
  { value: 'gold', label: 'Gold' },
  { value: 'silver', label: 'Silver' },
  { value: 'jewellery', label: 'Jewellery' },
  { value: 'grain', label: 'Grain / produce' },
  { value: 'cloth', label: 'Cloth' },
  { value: 'other', label: 'Other' },
];

interface InKindFormProps {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  offering?: InKindSummary;
  devotees: Array<{ id: string; fullName: string }>;
  currency: string;
  submitLabel: string;
}

export function InKindForm({ action, offering, devotees, currency, submitLabel }: InKindFormProps) {
  const [state, formAction, pending] = useActionState(action, initialFormState);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.message ? <Alert tone="success">{state.message}</Alert> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="category">Category</Label>
          <Select id="category" name="category" defaultValue={offering?.category ?? 'gold'}>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="item">Item</Label>
          <Input
            id="item"
            name="item"
            defaultValue={offering?.item}
            required
            minLength={2}
            placeholder="Gold ring, Silk saree, Rice…"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="donorName">Donor name</Label>
          <Input
            id="donorName"
            name="donorName"
            defaultValue={offering?.donorName}
            required
            minLength={2}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="devoteeId">Linked devotee (optional)</Label>
          <Select id="devoteeId" name="devoteeId" defaultValue={offering?.devoteeId ?? ''}>
            <option value="">— Not linked —</option>
            {devotees.map((d) => (
              <option key={d.id} value={d.id}>
                {d.fullName}
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
            step="0.001"
            min="0"
            defaultValue={offering?.quantity ?? ''}
            placeholder="Optional"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="unit">Unit</Label>
          <Input
            id="unit"
            name="unit"
            defaultValue={offering?.unit ?? ''}
            placeholder="grams, pieces, kg…"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="estimatedValue">Estimated value ({currency})</Label>
          <Input
            id="estimatedValue"
            name="estimatedValue"
            type="number"
            step="0.01"
            min="0"
            defaultValue={offering?.estimatedValue ?? ''}
            placeholder="Indicative valuation"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="receivedOn">Received on</Label>
          <Input
            id="receivedOn"
            name="receivedOn"
            type="date"
            defaultValue={offering?.receivedOn ?? today}
            required
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
