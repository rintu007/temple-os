'use client';

import { useActionState } from 'react';
import { OFFICER_DESIGNATIONS } from '@templeos/validators';
import { Alert, Button, Input, Label } from '@templeos/ui';
import { initialFormState, type FormState } from '@/lib/form-state';
import type { OfficeBearerSummary } from '@templeos/core';

interface OfficerFormProps {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  officer?: OfficeBearerSummary;
  submitLabel: string;
}

export function OfficerForm({ action, officer, submitLabel }: OfficerFormProps) {
  const [state, formAction, pending] = useActionState(action, initialFormState);

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.message ? <Alert tone="success">{state.message}</Alert> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" defaultValue={officer?.name} required minLength={2} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="designation">Designation</Label>
          <Input
            id="designation"
            name="designation"
            defaultValue={officer?.designation}
            list="officer-designations"
            required
            minLength={2}
          />
          <datalist id="officer-designations">
            {OFFICER_DESIGNATIONS.map((d) => (
              <option key={d} value={d} />
            ))}
          </datalist>
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="body">Committee / body</Label>
          <Input
            id="body"
            name="body"
            defaultValue={officer?.body ?? ''}
            placeholder="Board of Trustees"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" name="phone" defaultValue={officer?.phone ?? ''} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" defaultValue={officer?.email ?? ''} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="termStartsOn">Term start</Label>
          <Input
            id="termStartsOn"
            name="termStartsOn"
            type="date"
            defaultValue={officer?.termStartsOn ?? ''}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="termEndsOn">Term end</Label>
          <Input
            id="termEndsOn"
            name="termEndsOn"
            type="date"
            defaultValue={officer?.termEndsOn ?? ''}
          />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="note">Note</Label>
          <Input id="note" name="note" defaultValue={officer?.note ?? ''} />
        </div>
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? 'Saving…' : submitLabel}
      </Button>
    </form>
  );
}
