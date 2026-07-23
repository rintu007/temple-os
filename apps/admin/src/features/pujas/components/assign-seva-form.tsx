'use client';

import { useActionState } from 'react';
import { Button, Input, Select } from '@templeos/ui';
import { initialFormState, type FormState } from '@/lib/form-state';

interface PriestOption {
  id: string;
  name: string;
}

interface AssignSevaFormProps {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  priests: PriestOption[];
  priestId: string | null;
  scheduledOn: string | null;
  scheduledTime: string | null;
}

/** Inline scheduling controls on a booking row: priest + date + time. */
export function AssignSevaForm({
  action,
  priests,
  priestId,
  scheduledOn,
  scheduledTime,
}: AssignSevaFormProps) {
  const [state, formAction, pending] = useActionState(action, initialFormState);

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <Select
        name="priestId"
        defaultValue={priestId ?? ''}
        className="h-8 w-40 text-xs"
        aria-label="Priest"
      >
        <option value="">— No priest —</option>
        {priests.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </Select>
      <Input
        name="scheduledOn"
        type="date"
        defaultValue={scheduledOn ?? ''}
        className="h-8 w-36 text-xs"
        aria-label="Seva date"
      />
      <Input
        name="scheduledTime"
        type="time"
        defaultValue={scheduledTime?.slice(0, 5) ?? ''}
        className="h-8 w-28 text-xs"
        aria-label="Seva time"
      />
      <Button variant="outline" size="sm" type="submit" disabled={pending} className="h-8">
        {pending ? 'Saving…' : state.message ? 'Saved ✓' : 'Save'}
      </Button>
      {state.error ? <span className="text-xs text-destructive">{state.error}</span> : null}
    </form>
  );
}
