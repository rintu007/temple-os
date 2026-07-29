import type { Metadata } from 'next';
import Link from 'next/link';
import { Alert, Badge, cn } from '@templeos/ui';
import { SlotForm } from '@/features/darshan/components/slot-form';
import { requireTenantContext } from '@/lib/session';
import { darshanService } from '@/lib/services';

export const metadata: Metadata = { title: 'Darshan' };

function formatDate(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

export default async function DarshanPage() {
  const { ctx } = await requireTenantContext('worship');
  const result = await darshanService().listSlots(ctx);
  if (!result.ok) {
    return <Alert tone="error">{result.error.message}</Alert>;
  }
  const slots = result.value;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Darshan slots</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Capacity-limited timed-entry slots. Devotees book free tokens on your website; scan or
          tick them off at the gate.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-3">
          {slots.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-12 text-center">
              <h2 className="font-medium">No slots yet</h2>
              <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                Create a darshan slot and it opens for booking on your public site.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border rounded-xl border border-border bg-card shadow-card">
              {slots.map((s) => {
                const past = s.slotDate < today;
                return (
                  <li key={s.id}>
                    <Link
                      href={`/darshan/${s.id}`}
                      className={cn(
                        'flex items-center justify-between gap-4 p-4 hover:bg-muted/50',
                        (past || !s.isActive) && 'opacity-60',
                      )}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 font-medium">
                          {s.name}
                          {!s.isActive ? <Badge variant="outline">closed</Badge> : null}
                          {past ? <Badge variant="default">past</Badge> : null}
                        </div>
                        <div className="mt-0.5 text-sm text-muted-foreground">
                          {formatDate(s.slotDate)} · {s.startTime.slice(0, 5)}
                          {s.endTime ? `–${s.endTime.slice(0, 5)}` : ''}
                        </div>
                      </div>
                      <div className="text-right whitespace-nowrap">
                        <div className="font-semibold tabular-nums">
                          {s.booked}/{s.capacity}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {s.remaining} left
                        </div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-card">
          <h2 className="mb-4 text-sm font-medium text-muted-foreground">New slot</h2>
          <SlotForm />
        </div>
      </div>
    </div>
  );
}
