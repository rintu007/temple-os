'use client';

import { useActionState } from 'react';
import { Alert, Button, Input, Label, Select } from '@templeos/ui';
import { initialFormState } from '@/lib/form-state';
import { recordLeaveAction } from '../actions';

interface LeaveFormProps {
  priests: Array<{ id: string; name: string }>;
}

export function LeaveForm({ priests }: LeaveFormProps) {
  const [state, formAction, pending] = useActionState(recordLeaveAction, initialFormState);

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.message ? <Alert tone="success">{state.message}</Alert> : null}

      <div className="grid gap-4 sm:grid-cols-4">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="leave-priest">Priest</Label>
          <Select id="leave-priest" name="priestId" required defaultValue="">
            <option value="" disabled>
              Choose a priest
            </option>
            {priests.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="leave-start">From</Label>
          <Input id="leave-start" name="startDate" type="date" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="leave-end">To</Label>
          <Input id="leave-end" name="endDate" type="date" required />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="leave-reason">Reason</Label>
        <Input id="leave-reason" name="reason" placeholder="Optional" />
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? 'Recording…' : 'Record time off'}
      </Button>
    </form>
  );
}
