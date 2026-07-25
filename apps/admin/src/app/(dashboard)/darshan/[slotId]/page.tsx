import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge, Button, cn } from '@templeos/ui';
import {
  cancelTokenAction,
  markTokenUsedAction,
  toggleSlotActiveAction,
} from '@/features/darshan/actions';
import { requireTenantContext } from '@/lib/session';
import { darshanService } from '@/lib/services';

interface SlotDetailProps {
  params: Promise<{ slotId: string }>;
}

export const metadata: Metadata = { title: 'Darshan slot' };

const STATUS_VARIANT = {
  booked: 'primary',
  used: 'success',
  cancelled: 'outline',
} as const;

function formatDate(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default async function DarshanSlotPage({ params }: SlotDetailProps) {
  const { slotId } = await params;
  const { ctx } = await requireTenantContext();

  const [slotResult, tokensResult] = await Promise.all([
    darshanService().getSlot(ctx, slotId),
    darshanService().listTokens(ctx, slotId),
  ]);
  if (!slotResult.ok) notFound();
  const slot = slotResult.value;
  const tokens = tokensResult.ok ? tokensResult.value : [];
  const pct = slot.capacity > 0 ? Math.min(100, Math.round((slot.booked / slot.capacity) * 100)) : 0;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/darshan" className="text-sm text-muted-foreground hover:text-foreground">
          ← Darshan slots
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{slot.name}</h1>
          <form action={toggleSlotActiveAction.bind(null, slotId, !slot.isActive)}>
            <Button variant="outline" size="sm" type="submit">
              {slot.isActive ? 'Close bookings' : 'Reopen bookings'}
            </Button>
          </form>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {formatDate(slot.slotDate)} · {slot.startTime.slice(0, 5)}
          {slot.endTime ? `–${slot.endTime.slice(0, 5)}` : ''}
          {slot.isActive ? '' : ' · closed'}
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 shadow-card">
        <div className="flex items-baseline justify-between text-sm">
          <span className="font-medium">
            {slot.booked} of {slot.capacity} booked
          </span>
          <span className="text-muted-foreground">{slot.remaining} left</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {tokens.length === 0 ? (
        <p className="text-sm text-muted-foreground">No tokens booked yet.</p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card shadow-card">
          {tokens.map((t) => (
            <li
              key={t.id}
              className={cn(
                'flex items-center justify-between gap-4 p-4',
                t.status === 'cancelled' && 'opacity-50',
              )}
            >
              <div className="flex items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-sm font-semibold text-accent-foreground tabular-nums">
                  {t.tokenNumber}
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 font-medium">
                    {t.devoteeName}
                    <Badge variant={STATUS_VARIANT[t.status]}>{t.status}</Badge>
                  </div>
                  <div className="mt-0.5 text-sm text-muted-foreground">
                    {t.partySize} {t.partySize === 1 ? 'person' : 'people'}
                    {t.phone ? ` · ${t.phone}` : ''}
                  </div>
                </div>
              </div>
              {t.status === 'booked' ? (
                <div className="flex gap-1">
                  <form action={markTokenUsedAction.bind(null, slotId, t.id)}>
                    <Button variant="ghost" size="sm" type="submit">
                      Mark used
                    </Button>
                  </form>
                  <form action={cancelTokenAction.bind(null, slotId, t.id)}>
                    <Button variant="ghost" size="sm" type="submit">
                      Cancel
                    </Button>
                  </form>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
