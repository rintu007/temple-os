import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Button } from '@templeos/ui';
import { deleteEventAction, updateEventAction } from '@/features/events/actions';
import { EventForm } from '@/features/events/components/event-form';
import { requireTenantContext } from '@/lib/session';
import { eventService } from '@/lib/services';

interface EventDetailProps {
  params: Promise<{ eventId: string }>;
}

export const metadata: Metadata = { title: 'Event' };

export default async function EventDetailPage({ params }: EventDetailProps) {
  const { eventId } = await params;
  const { ctx } = await requireTenantContext();

  const event = await eventService().getEvent(ctx, eventId);
  if (!event.ok) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <Link href="/events" className="text-sm text-muted-foreground hover:text-foreground">
          ← Events
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{event.value.title}</h1>
      </div>

      <section className="rounded-xl border border-border bg-card shadow-card p-6">
        <h2 className="mb-4 text-sm font-medium text-muted-foreground">Details</h2>
        <EventForm
          action={updateEventAction.bind(null, eventId)}
          event={event.value}
          submitLabel="Save changes"
        />
      </section>

      <section className="rounded-xl border border-border bg-card shadow-card p-6">
        <h2 className="text-sm font-medium text-muted-foreground">Delete</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Removes this event from the admin and your website.
        </p>
        <form action={deleteEventAction.bind(null, eventId)} className="mt-4">
          <Button variant="destructive" size="sm" type="submit">
            Delete event
          </Button>
        </form>
      </section>
    </div>
  );
}
