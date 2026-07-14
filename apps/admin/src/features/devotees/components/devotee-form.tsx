'use client';

import { useActionState } from 'react';
import type { DevoteeSummary } from '@templeos/core';
import { Alert, Button, Input, Label, Select } from '@templeos/ui';
import { initialFormState, type FormState } from '@/lib/form-state';

interface DevoteeFormProps {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  devotee?: DevoteeSummary;
  submitLabel: string;
}

export function DevoteeForm({ action, devotee, submitLabel }: DevoteeFormProps) {
  const [state, formAction, pending] = useActionState(action, initialFormState);

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.message ? <Alert tone="success">{state.message}</Alert> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="fullName">Full name</Label>
          <Input id="fullName" name="fullName" defaultValue={devotee?.fullName} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" name="phone" type="tel" defaultValue={devotee?.phone ?? ''} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" defaultValue={devotee?.email ?? ''} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="gender">Gender</Label>
          <Select id="gender" name="gender" defaultValue={devotee?.gender ?? ''}>
            <option value="">—</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="dateOfBirth">Date of birth</Label>
          <Input
            id="dateOfBirth"
            name="dateOfBirth"
            type="date"
            defaultValue={devotee?.dateOfBirth ?? ''}
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="familyName">Family / household</Label>
          <Input
            id="familyName"
            name="familyName"
            defaultValue={devotee?.familyName ?? ''}
            placeholder="Chatterjee Family"
          />
          <p className="text-xs text-muted-foreground">
            Devotees with the same family name are grouped into one household.
          </p>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="addressLine1">Address</Label>
          <Input id="addressLine1" name="addressLine1" defaultValue={devotee?.addressLine1 ?? ''} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="city">City</Label>
          <Input id="city" name="city" defaultValue={devotee?.city ?? ''} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="state">State / Division</Label>
          <Input id="state" name="state" defaultValue={devotee?.state ?? ''} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="postalCode">Postal code</Label>
          <Input id="postalCode" name="postalCode" defaultValue={devotee?.postalCode ?? ''} />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="notes">Notes</Label>
          <Input id="notes" name="notes" defaultValue={devotee?.notes ?? ''} />
        </div>
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? 'Saving…' : submitLabel}
      </Button>
    </form>
  );
}
