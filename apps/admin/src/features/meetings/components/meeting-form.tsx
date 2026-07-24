'use client';

import { useActionState } from 'react';
import { MEETING_STATUSES, MEETING_STATUS_LABELS } from '@templeos/validators';
import { Alert, Button, Input, Label, Select, Textarea } from '@templeos/ui';
import { initialFormState, type FormState } from '@/lib/form-state';

interface MeetingDefaults {
  title: string;
  body: string;
  meetingOn: string;
  location: string;
  attendees: string;
  agenda: string;
  minutes: string;
  decisions: string;
  status: string;
}

interface MeetingFormProps {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  submitLabel: string;
  defaults?: MeetingDefaults;
}

export function MeetingForm({ action, submitLabel, defaults }: MeetingFormProps) {
  const [state, formAction, pending] = useActionState(action, initialFormState);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.message ? <Alert tone="success">{state.message}</Alert> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            name="title"
            placeholder="Quarterly board meeting"
            required
            minLength={2}
            defaultValue={defaults?.title}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="body">Committee / body</Label>
          <Input
            id="body"
            name="body"
            placeholder="Board of Trustees"
            defaultValue={defaults?.body}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="meetingOn">Date</Label>
          <Input
            id="meetingOn"
            name="meetingOn"
            type="date"
            required
            defaultValue={defaults?.meetingOn ?? today}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="location">Location</Label>
          <Input
            id="location"
            name="location"
            placeholder="Temple office"
            defaultValue={defaults?.location}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <Select id="status" name="status" defaultValue={defaults?.status ?? 'scheduled'}>
            {MEETING_STATUSES.map((s) => (
              <option key={s} value={s}>
                {MEETING_STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="attendees">Attendees</Label>
          <Textarea
            id="attendees"
            name="attendees"
            rows={2}
            placeholder="Names of those present"
            defaultValue={defaults?.attendees}
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="agenda">Agenda</Label>
          <Textarea
            id="agenda"
            name="agenda"
            rows={4}
            placeholder="Points to be discussed"
            defaultValue={defaults?.agenda}
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="minutes">Minutes</Label>
          <Textarea
            id="minutes"
            name="minutes"
            rows={6}
            placeholder="What was discussed"
            defaultValue={defaults?.minutes}
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="decisions">Decisions / resolutions</Label>
          <Textarea
            id="decisions"
            name="decisions"
            rows={4}
            placeholder="Resolutions passed"
            defaultValue={defaults?.decisions}
          />
        </div>
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? 'Saving…' : submitLabel}
      </Button>
    </form>
  );
}
