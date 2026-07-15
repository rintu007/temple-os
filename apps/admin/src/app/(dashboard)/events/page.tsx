import type { Metadata } from 'next';
import Link from 'next/link';
import { Alert, cn } from '@templeos/ui';
import { requireTenantContext } from '@/lib/session';
import { eventService } from '@/lib/services';

export const metadata: Metadata = { title: 'Events' };

interface EventsPageProps {
  searchParams: Promise<{ scope?: string; page?: string }>;
}

function formatWhen(startsAt: Date, allDay: boolean): string {
  const date = startsAt.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  if (allDay) return date;
  const time = startsAt.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
  return `${date} · ${time}`;
}

export default async function EventsPage({ searchParams }: EventsPageProps) {
  const { scope: rawScope, page } = await searchParams;
  const scope = rawScope === 'past' ? 'past' : 'upcoming';
  const { ctx } = await requireTenantContext();

  const result = await eventService().listEvents(ctx, { scope, page: page ?? 1 });
  if (!result.ok) {
    return <Alert tone="error">{result.error.message}</Alert>;
  }
  const { items, total, page: currentPage, pageSize } = result.value;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Events &amp; Festivals</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Published events appear on your website automatically.
          </p>
        </div>
        <Link
          href="/events/new"
          className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Add event
        </Link>
      </div>

      <div className="flex gap-1 rounded-lg border border-border p-1 text-sm w-fit">
        {(['upcoming', 'past'] as const).map((s) => (
          <Link
            key={s}
            href={`/events?scope=${s}`}
            className={cn(
              'rounded-md px-4 py-1.5 capitalize',
              scope === s ? 'bg-muted font-medium' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {s}
          </Link>
        ))}
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <h2 className="font-medium">No {scope} events</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            {scope === 'upcoming'
              ? 'Add your next event or festival — it publishes to your website instantly.'
              : 'Past events will appear here.'}
          </p>
        </div>
      ) : (
        <>
          <ul className="divide-y divide-border rounded-xl border border-border">
            {items.map((e) => (
              <li key={e.id}>
                <Link
                  href={`/events/${e.id}`}
                  className="flex items-center justify-between gap-4 p-4 hover:bg-muted/50"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 font-medium">
                      {e.title}
                      {e.kind === 'festival' ? (
                        <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
                          Festival
                        </span>
                      ) : null}
                      {!e.isPublished ? (
                        <span className="rounded bg-muted px-1.5 py-0.5 text-xs uppercase text-muted-foreground">
                          Draft
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-0.5 truncate text-sm text-muted-foreground">
                      {formatWhen(e.startsAt, e.allDay)}
                      {e.location ? ` · ${e.location}` : ''}
                    </div>
                  </div>
                  <span className="text-sm text-muted-foreground">Edit →</span>
                </Link>
              </li>
            ))}
          </ul>

          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Page {currentPage} of {totalPages}
              </span>
              <div className="flex gap-2">
                {currentPage > 1 && (
                  <Link
                    href={`/events?scope=${scope}&page=${currentPage - 1}`}
                    className="text-primary hover:underline"
                  >
                    ← Previous
                  </Link>
                )}
                {currentPage < totalPages && (
                  <Link
                    href={`/events?scope=${scope}&page=${currentPage + 1}`}
                    className="text-primary hover:underline"
                  >
                    Next →
                  </Link>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
