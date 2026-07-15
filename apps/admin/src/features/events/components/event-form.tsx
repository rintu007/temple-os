'use client';

import { useActionState } from 'react';
import type { EventSummary } from '@templeos/core';
import { Alert, Button, Input, Label, Select } from '@templeos/ui';
import { initialFormState, type FormState } from '@/lib/form-state';

interface EventFormProps {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  event?: EventSummary;
  submitLabel: string;
}

function datePart(d: Date | null | undefined): string {
  if (!d) return '';
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function timePart(d: Date | null | undefined, allDay: boolean): string {
  if (!d || allDay) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function EventForm({ action, event, submitLabel }: EventFormProps) {
  const [state, formAction, pending] = useActionState(action, initialFormState);

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.message ? <Alert tone="success">{state.message}</Alert> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="title">Title</Label>
          <Input id="title" name="title" defaultValue={event?.title} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="kind">Type</Label>
          <Select id="kind" name="kind" defaultValue={event?.kind ?? 'event'} required>
            <option value="event">Event</option>
            <option value="festival">Festival</option>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="location">Location</Label>
          <Input
            id="location"
            name="location"
            defaultValue={event?.location ?? ''}
            placeholder="Main hall"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="date">Date</Label>
          <Input id="date" name="date" type="date" defaultValue={datePart(event?.startsAt)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="startTime">Start time (empty = all day)</Label>
          <Input
            id="startTime"
            name="startTime"
            type="time"
            defaultValue={timePart(event?.startsAt, event?.allDay ?? false)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="endDate">End date (multi-day)</Label>
          <Input id="endDate" name="endDate" type="date" defaultValue={datePart(event?.endsAt)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="endTime">End time</Label>
          <Input
            id="endTime"
            name="endTime"
            type="time"
            defaultValue={timePart(event?.endsAt, event?.allDay ?? false)}
          />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="description">Description</Label>
          <Input
            id="description"
            name="description"
            defaultValue={event?.description ?? ''}
            placeholder="Shown on your public website"
          />
        </div>

        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input
            type="checkbox"
            name="isPublished"
            defaultChecked={event?.isPublished ?? true}
            className="h-4 w-4 rounded border-border accent-[hsl(var(--primary))]"
          />
          Published on the website
        </label>
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? 'Saving…' : submitLabel}
      </Button>
    </form>
  );
}
