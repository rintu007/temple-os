'use client';

import { useActionState } from 'react';
import { Alert, Button, Label, Select, Textarea } from '@templeos/ui';
import { initialFormState } from '@/lib/form-state';
import { addDutyAssignmentAction } from '../actions';

const DAYS = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
];

interface DutyRosterFormProps {
  priests: Array<{ id: string; name: string }>;
  schedules: Array<{ id: string; label: string }>;
}

export function DutyRosterForm({ priests, schedules }: DutyRosterFormProps) {
  const [state, formAction, pending] = useActionState(addDutyAssignmentAction, initialFormState);

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.message ? <Alert tone="success">{state.message}</Alert> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="duty-priest">Priest</Label>
          <Select id="duty-priest" name="priestId" required defaultValue="">
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
          <Label htmlFor="duty-schedule">Ritual</Label>
          <Select id="duty-schedule" name="dailyScheduleId" required defaultValue="">
            <option value="" disabled>
              Choose a ritual
            </option>
            {schedules.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Days of week</Label>
        <p className="text-xs text-muted-foreground">Leave all unchecked for every day.</p>
        <div className="flex flex-wrap gap-3">
          {DAYS.map((d) => (
            <label key={d.value} className="flex items-center gap-1.5 text-sm">
              <input type="checkbox" name="daysOfWeek" value={d.value} className="h-4 w-4 rounded border-input" />
              {d.label}
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="duty-notes">Notes</Label>
        <Textarea id="duty-notes" name="notes" rows={2} placeholder="Optional" />
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? 'Assigning…' : 'Assign duty'}
      </Button>
    </form>
  );
}
