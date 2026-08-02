import type { Metadata } from 'next';
import { Section } from '@/components/section';
import { healthService } from '@/lib/services';

export const metadata: Metadata = {
  title: 'System Status — TempleOS',
  description: 'Current status of TempleOS services.',
};

/** Reflects whatever the health-check cron last recorded — see /api/cron/health-check. */
export const revalidate = 60;

const SERVICE_LABELS: Record<string, string> = {
  db: 'Database',
  'sites-app': 'Public temple websites',
};

export default async function StatusPage() {
  const statuses = await healthService().listStatuses();
  const byService = new Map(statuses.map((s) => [s.service, s]));
  const rows = Object.entries(SERVICE_LABELS).map(([service, label]) => ({
    label,
    entry: byService.get(service),
  }));
  const allUp = rows.every((r) => r.entry?.status === 'up');

  return (
    <main>
      <div className="mx-auto max-w-3xl px-6 pt-20 pb-4 text-center sm:pt-28">
        <div className="text-xs font-semibold tracking-[0.25em] text-primary uppercase">Status</div>
        <h1 className="mt-3 font-[family-name:var(--font-display)] text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          {allUp ? 'All systems operational' : 'System status'}
        </h1>
      </div>

      <Section>
        <ul className="mx-auto max-w-xl divide-y divide-border rounded-lg border">
          {rows.map(({ label, entry }) => (
            <li key={label} className="flex items-center justify-between px-5 py-4">
              <span className="font-medium">{label}</span>
              <StatusBadge status={entry?.status} updatedAt={entry?.updatedAt} />
            </li>
          ))}
        </ul>
        <p className="mx-auto mt-6 max-w-xl text-center text-sm text-muted-foreground">
          Updated automatically by our internal monitoring. "Not yet monitored" means no check has
          run for that service yet.
        </p>
      </Section>
    </main>
  );
}

function StatusBadge({ status, updatedAt }: { status?: 'up' | 'down'; updatedAt?: Date }) {
  if (!status) {
    return <span className="text-sm text-muted-foreground">Not yet monitored</span>;
  }
  const isUp = status === 'up';
  return (
    <span className="flex items-center gap-2 text-sm">
      <span className={`h-2 w-2 rounded-full ${isUp ? 'bg-green-500' : 'bg-red-500'}`} aria-hidden />
      <span className={isUp ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}>
        {isUp ? 'Operational' : 'Down'}
      </span>
      {updatedAt ? (
        <span className="text-muted-foreground">
          ·{' '}
          {updatedAt.toLocaleString('en-US', {
            dateStyle: 'medium',
            timeStyle: 'short',
            timeZone: 'UTC',
          })}{' '}
          UTC
        </span>
      ) : null}
    </span>
  );
}
