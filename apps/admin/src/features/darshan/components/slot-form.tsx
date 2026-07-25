'use client';

import { useActionState } from 'react';
import { Alert, Button, Input, Label } from '@templeos/ui';
import { initialFormState } from '@/lib/form-state';
import { createSlotAction } from '../actions';

export function SlotForm() {
  const [state, formAction, pending] = useActionState(createSlotAction, initialFormState);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.message ? <Alert tone="success">{state.message}</Alert> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="name">Slot name</Label>
          <Input id="name" name="name" placeholder="Morning Darshan" required minLength={2} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="slotDate">Date</Label>
          <Input id="slotDate" name="slotDate" type="date" defaultValue={today} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="capacity">Capacity</Label>
          <Input
            id="capacity"
            name="capacity"
            type="number"
            min="1"
            step="1"
            placeholder="100"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="startTime">Start time</Label>
          <Input id="startTime" name="startTime" type="time" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="endTime">End time (optional)</Label>
          <Input id="endTime" name="endTime" type="time" />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="note">Note</Label>
          <Input id="note" name="note" placeholder="Dress code, entrance, etc." />
        </div>
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? 'Creating…' : 'Create slot'}
      </Button>
    </form>
  );
}
