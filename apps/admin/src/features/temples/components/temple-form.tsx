'use client';

import { useActionState } from 'react';
import type { TempleSummary } from '@templeos/core';
import { Alert, Button, Input, Label } from '@templeos/ui';
import { initialFormState, type FormState } from '@/lib/form-state';

interface TempleFormProps {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  temple?: TempleSummary;
  submitLabel: string;
}

export function TempleForm({ action, temple, submitLabel }: TempleFormProps) {
  const [state, formAction, pending] = useActionState(action, initialFormState);

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.message ? <Alert tone="success">{state.message}</Alert> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="name">Temple name</Label>
          <Input id="name" name="name" defaultValue={temple?.name} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="deity">Presiding deity</Label>
          <Input id="deity" name="deity" defaultValue={temple?.deity ?? ''} placeholder="Maa Kali" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" name="phone" type="tel" defaultValue={temple?.phone ?? ''} />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" defaultValue={temple?.email ?? ''} />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="addressLine1">Address line 1</Label>
          <Input id="addressLine1" name="addressLine1" defaultValue={temple?.addressLine1 ?? ''} />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="addressLine2">Address line 2</Label>
          <Input id="addressLine2" name="addressLine2" defaultValue={temple?.addressLine2 ?? ''} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="city">City</Label>
          <Input id="city" name="city" defaultValue={temple?.city ?? ''} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="state">State / Division</Label>
          <Input id="state" name="state" defaultValue={temple?.state ?? ''} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="postalCode">Postal code</Label>
          <Input id="postalCode" name="postalCode" defaultValue={temple?.postalCode ?? ''} />
        </div>
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? 'Saving…' : submitLabel}
      </Button>
    </form>
  );
}
