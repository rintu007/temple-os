'use client';

import { useActionState } from 'react';
import type { VendorSummary } from '@templeos/core';
import { Alert, Button, Input, Label, Textarea } from '@templeos/ui';
import { initialFormState, type FormState } from '@/lib/form-state';

interface VendorFormProps {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  vendor?: VendorSummary;
  submitLabel: string;
}

export function VendorForm({ action, vendor, submitLabel }: VendorFormProps) {
  const [state, formAction, pending] = useActionState(action, initialFormState);

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.message ? <Alert tone="success">{state.message}</Alert> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">Vendor name</Label>
          <Input id="name" name="name" defaultValue={vendor?.name} required minLength={2} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="category">Category</Label>
          <Input
            id="category"
            name="category"
            defaultValue={vendor?.category ?? ''}
            placeholder="Prasadam supplies, Electrician…"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="contactPerson">Contact person</Label>
          <Input
            id="contactPerson"
            name="contactPerson"
            defaultValue={vendor?.contactPerson ?? ''}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" name="phone" defaultValue={vendor?.phone ?? ''} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" defaultValue={vendor?.email ?? ''} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="taxId">Tax ID (GSTIN / BIN)</Label>
          <Input id="taxId" name="taxId" defaultValue={vendor?.taxId ?? ''} />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="address">Address</Label>
          <Textarea id="address" name="address" rows={2} defaultValue={vendor?.address ?? ''} />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="note">Note</Label>
          <Input id="note" name="note" defaultValue={vendor?.note ?? ''} />
        </div>
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? 'Saving…' : submitLabel}
      </Button>
    </form>
  );
}
