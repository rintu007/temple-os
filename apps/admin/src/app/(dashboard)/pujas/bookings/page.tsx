import type { Metadata } from 'next';
import Link from 'next/link';
import { Alert, Button, cn, formatMoney, formatTime } from '@templeos/ui';
import {
  assignSevaAction,
  cancelBookingAction,
  completeBookingAction,
} from '@/features/pujas/actions';
import { AssignSevaForm } from '@/features/pujas/components/assign-seva-form';
import { requireTenantContext } from '@/lib/session';
import { pujaService } from '@/lib/services';

export const metadata: Metadata = { title: 'Puja bookings' };

interface BookingsPageProps {
  searchParams: Promise<{ status?: string; page?: string }>;
}

const STATUS_TABS = ['confirmed', 'completed', 'cancelled', 'all'] as const;
const STATUS_BADGE: Record<string, string> = {
  confirmed: 'bg-primary/10 text-primary',
  completed: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200',
  cancelled: 'bg-muted text-muted-foreground',
  pending: 'bg-muted text-muted-foreground',
};

export default async function PujaBookingsPage({ searchParams }: BookingsPageProps) {
  const { status: rawStatus, page } = await searchParams;
  const status = STATUS_TABS.includes(rawStatus as (typeof STATUS_TABS)[number])
    ? (rawStatus as (typeof STATUS_TABS)[number])
    : 'confirmed';
  const { ctx } = await requireTenantContext();

  const [result, priestsResult] = await Promise.all([
    pujaService().listBookings(ctx, { status, page: page ?? 1 }),
    pujaService().listPriests(ctx),
  ]);
  if (!result.ok) {
    return <Alert tone="error">{result.error.message}</Alert>;
  }
  const priests = priestsResult.ok ? priestsResult.value.filter((p) => p.isActive) : [];
  const { items, total, page: currentPage, pageSize } = result.value;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/pujas" className="text-sm text-muted-foreground hover:text-foreground">
            ← Pujas
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Puja bookings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Paid bookings from your website. Assign a priest and date, then mark done after the
            seva.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/pujas/schedule"
            className="inline-flex h-9.5 items-center rounded-lg border border-input bg-card px-4 text-sm font-medium shadow-card transition-colors hover:bg-muted/60"
          >
            Day schedule
          </Link>
          <Link
            href="/pujas/priests"
            className="inline-flex h-9.5 items-center rounded-lg border border-input bg-card px-4 text-sm font-medium shadow-card transition-colors hover:bg-muted/60"
          >
            Priests
          </Link>
        </div>
      </div>

      <div className="flex w-fit gap-1 rounded-lg border border-border p-1 text-sm">
        {STATUS_TABS.map((s) => (
          <Link
            key={s}
            href={`/pujas/bookings?status=${s}`}
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
          <h2 className="font-medium">No {status === 'all' ? '' : status} bookings</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Bookings appear here once devotees book and pay on your website.
          </p>
        </div>
      ) : (
        <>
          <ul className="divide-y divide-border rounded-xl border border-border bg-card shadow-card">
            {items.map((b) => (
              <li key={b.id} className="space-y-3 p-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 font-medium">
                      {b.pujaName}
                      <span
                        className={cn(
                          'rounded px-1.5 py-0.5 text-xs font-medium capitalize',
                          STATUS_BADGE[b.status],
                        )}
                      >
                        {b.status}
                      </span>
                    </div>
                    <div className="mt-0.5 text-sm text-muted-foreground">
                      {b.devoteeName}
                      {b.phone ? ` · ${b.phone}` : ''}
                      {b.preferredDate
                        ? ` · preferred ${new Date(b.preferredDate).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}`
                        : ''}
                      {b.status !== 'confirmed' && b.scheduledOn
                        ? ` · seva ${new Date(`${b.scheduledOn}T12:00:00`).toLocaleDateString(
                            'en-IN',
                            { day: 'numeric', month: 'short' },
                          )}${b.scheduledTime ? ` ${formatTime(b.scheduledTime)}` : ''}${
                            b.priestName ? ` — ${b.priestName}` : ''
                          }`
                        : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold">{formatMoney(b.amount, b.currency)}</span>
                    {b.status === 'confirmed' ? (
                      <>
                        <form action={completeBookingAction.bind(null, b.id)}>
                          <Button size="sm" type="submit">
                            Mark done
                          </Button>
                        </form>
                        <form action={cancelBookingAction.bind(null, b.id)}>
                          <Button variant="ghost" size="sm" type="submit">
                            Cancel
                          </Button>
                        </form>
                      </>
                    ) : null}
                  </div>
                </div>
                {b.status === 'confirmed' ? (
                  <AssignSevaForm
                    action={assignSevaAction.bind(null, b.id)}
                    priests={priests}
                    priestId={b.priestId}
                    scheduledOn={b.scheduledOn}
                    scheduledTime={b.scheduledTime}
                  />
                ) : null}
              </li>
            ))}
          </ul>

          {totalPages > 1 ? (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Page {currentPage} of {totalPages} · {total} total
              </span>
              <div className="flex gap-2">
                {currentPage > 1 ? (
                  <Link
                    href={`/pujas/bookings?status=${status}&page=${currentPage - 1}`}
                    className="text-primary hover:underline"
                  >
                    ← Previous
                  </Link>
                ) : null}
                {currentPage < totalPages ? (
                  <Link
                    href={`/pujas/bookings?status=${status}&page=${currentPage + 1}`}
                    className="text-primary hover:underline"
                  >
                    Next →
                  </Link>
                ) : null}
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
