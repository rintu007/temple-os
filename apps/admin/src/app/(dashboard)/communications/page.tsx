import type { Metadata } from 'next';
import type { BroadcastSummary } from '@templeos/core';
import { BROADCAST_SEGMENT_LABELS } from '@templeos/validators';
import { Alert, Badge } from '@templeos/ui';
import { ComposeForm } from '@/features/communications/components/compose-form';
import { requireTenantContext } from '@/lib/session';
import { communicationService } from '@/lib/services';

export const metadata: Metadata = { title: 'Communications' };

const STATUS_VARIANT: Record<BroadcastSummary['status'], 'success' | 'warning' | 'destructive'> = {
  sent: 'success',
  partial: 'warning',
  failed: 'destructive',
};

export default async function CommunicationsPage() {
  const { ctx } = await requireTenantContext();
  const [counts, history] = await Promise.all([
    communicationService().getSegmentCounts(ctx),
    communicationService().listBroadcasts(ctx),
  ]);

  if (!counts.ok) {
    return <Alert tone="error">{counts.error.message}</Alert>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Communications</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Email your devotees — festival notices, event reminders, appeals. Every send is logged.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <section className="rounded-xl border border-border bg-card p-6 shadow-card">
          <h2 className="mb-4 text-sm font-medium text-muted-foreground">New broadcast</h2>
          <ComposeForm counts={counts.value} />
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">Sent history</h2>
          {!history.ok ? (
            <Alert tone="error">{history.error.message}</Alert>
          ) : history.value.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-10 text-center">
              <p className="text-sm text-muted-foreground">No broadcasts sent yet.</p>
            </div>
          ) : (
            <ul className="divide-y divide-border rounded-xl border border-border bg-card shadow-card">
              {history.value.map((b) => (
                <li key={b.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{b.subject}</div>
                      <div className="mt-0.5 text-sm text-muted-foreground">
                        {BROADCAST_SEGMENT_LABELS[b.segment]} ·{' '}
                        {b.sentAt.toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <Badge variant={STATUS_VARIANT[b.status]}>{b.status}</Badge>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {b.sentCount}/{b.recipientCount} delivered
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
