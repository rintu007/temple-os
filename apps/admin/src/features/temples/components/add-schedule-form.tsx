'use client';

import { useActionState } from 'react';
import { Alert, Button, Input, Label } from '@templeos/ui';
import { initialFormState, type FormState } from '@/lib/form-state';

interface AddScheduleFormProps {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
}

export function AddScheduleForm({ action }: AddScheduleFormProps) {
  const [state, formAction, pending] = useActionState(action, initialFormState);

  return (
    <form action={formAction} className="space-y-3">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
        <div className="space-y-1">
          <Label htmlFor="title">Ritual / activity</Label>
          <Input id="title" name="title" placeholder="Mangala Aarti" required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="startTime">Starts</Label>
          <Input id="startTime" name="startTime" type="time" required className="w-28" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="endTime">Ends</Label>
          <Input id="endTime" name="endTime" type="time" className="w-28" />
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="description">Note (optional)</Label>
        <Input id="description" name="description" placeholder="Open to all devotees" />
      </div>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? 'Adding…' : 'Add to schedule'}
      </Button>
    </form>
  );
}
