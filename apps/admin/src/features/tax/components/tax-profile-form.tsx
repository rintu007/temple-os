'use client';

import { useActionState } from 'react';
import type { TaxProfile } from '@templeos/core';
import { Alert, Button, Input, Label } from '@templeos/ui';
import { initialFormState } from '@/lib/form-state';
import { saveTaxProfileAction } from '../actions';

export function TaxProfileForm({ profile }: { profile: TaxProfile | null }) {
  const [state, formAction, pending] = useActionState(saveTaxProfileAction, initialFormState);

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.message ? <Alert tone="success">{state.message}</Alert> : null}

      <div className="space-y-2">
        <Label htmlFor="legalName">Registered legal name</Label>
        <Input
          id="legalName"
          name="legalName"
          defaultValue={profile?.legalName ?? ''}
          placeholder="Shree Temple Charitable Trust"
          maxLength={200}
          required
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="registrationNumber">80G registration number</Label>
          <Input
            id="registrationNumber"
            name="registrationNumber"
            defaultValue={profile?.registrationNumber ?? ''}
            placeholder="AAATT1234CF20219"
            maxLength={100}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pan">Trust PAN</Label>
          <Input
            id="pan"
            name="pan"
            defaultValue={profile?.pan ?? ''}
            placeholder="AAATT1234C"
            maxLength={10}
            className="uppercase"
            style={{ textTransform: 'uppercase' }}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="validFrom">Valid from</Label>
          <Input id="validFrom" name="validFrom" type="date" defaultValue={profile?.validFrom ?? ''} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="validUntil">Valid until</Label>
          <Input
            id="validUntil"
            name="validUntil"
            type="date"
            defaultValue={profile?.validUntil ?? ''}
          />
        </div>
      </div>

      <label className="flex items-center gap-2.5 text-sm">
        <input
          type="checkbox"
          name="showOnReceipt"
          defaultChecked={profile?.showOnReceipt ?? true}
          className="size-4 rounded border-input"
        />
        Print the 80G block on donation receipts
      </label>

      <Button type="submit" disabled={pending}>
        {pending ? 'Saving…' : 'Save 80G profile'}
      </Button>
    </form>
  );
}
