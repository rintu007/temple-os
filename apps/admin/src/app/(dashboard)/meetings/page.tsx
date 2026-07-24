import type { Metadata } from 'next';
import Link from 'next/link';
import { MEETING_STATUS_LABELS, type MeetingStatus } from '@templeos/validators';
import { Alert, Badge, cn } from '@templeos/ui';
import { requireTenantContext } from '@/lib/session';
import { meetingService } from '@/lib/services';

export const metadata: Metadata = { title: 'Meetings' };

interface MeetingsPageProps {
  searchParams: Promise<{ status?: string }>;
}

const STATUS_TABS = ['all', 'scheduled', 'held', 'cancelled'] as const;

const STATUS_VARIANT: Record<MeetingStatus, 'primary' | 'success' | 'outline'> = {
  scheduled: 'primary',
  held: 'success',
  cancelled: 'outline',
};

function formatDate(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default async function MeetingsPage({ searchParams }: MeetingsPageProps) {
  const { status: rawStatus } = await searchParams;
  const status = STATUS_TABS.includes(rawStatus as (typeof STATUS_TABS)[number])
    ? (rawStatus as (typeof STATUS_TABS)[number])
    : 'all';
  const { ctx } = await requireTenantContext();

  const result = await meetingService().listMeetings(ctx, status);
  if (!result.ok) {
    return <Alert tone="error">{result.error.message}</Alert>;
  }
  const items = result.value;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Meetings & minutes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            A record of your trust and committee meetings — agendas, minutes and resolutions.
          </p>
        </div>
        <Link
          href="/meetings/new"
          className="inline-flex h-9.5 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-card transition-colors hover:bg-primary/90"
        >
          New meeting
        </Link>
      </div>

      <div className="flex w-fit gap-1 rounded-lg border border-border p-1 text-sm">
        {STATUS_TABS.map((s) => (
          <Link
            key={s}
            href={`/meetings?status=${s}`}
            className={cn(
              'rounded-md px-4 py-1.5 capitalize',
              status === s ? 'bg-muted font-medium' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {s}
          </Link>
        ))}
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <h2 className="font-medium">No {status === 'all' ? '' : status} meetings</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Record your meetings to keep an auditable governance history.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card shadow-card">
          {items.map((m) => (
            <li key={m.id}>
              <Link
                href={`/meetings/${m.id}`}
                className={cn(
                  'flex items-center justify-between gap-4 p-4 hover:bg-muted/50',
                  m.status === 'cancelled' && 'opacity-60',
                )}
              >
                <div className="min-w-0">
                  <div className="truncate font-medium">{m.title}</div>
                  <div className="mt-0.5 truncate text-sm text-muted-foreground">
                    {formatDate(m.meetingOn)}
                    {m.body ? ` · ${m.body}` : ''}
                    {m.location ? ` · ${m.location}` : ''}
                  </div>
                </div>
                <Badge variant={STATUS_VARIANT[m.status]}>{MEETING_STATUS_LABELS[m.status]}</Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
