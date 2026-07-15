import type { Metadata } from 'next';
import { createEventAction } from '@/features/events/actions';
import { EventForm } from '@/features/events/components/event-form';

export const metadata: Metadata = { title: 'Add event' };

export default function NewEventPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Add event</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Leave the start time empty for all-day events; set an end date for multi-day festivals.
        </p>
      </div>
      <div className="rounded-xl border border-border p-6">
        <EventForm action={createEventAction} submitLabel="Create event" />
      </div>
    </div>
  );
}
