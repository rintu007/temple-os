import type { Metadata } from 'next';
import Link from 'next/link';
import { Alert, Badge, formatMoney, formatTime } from '@templeos/ui';
import { requireTenantContext } from '@/lib/session';
import { pujaService } from '@/lib/services';

export const metadata: Metadata = { title: 'Seva schedule' };

interface SchedulePageProps {
  searchParams: Promise<{ date?: string }>;
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

function shiftDay(day: string, delta: number): string {
  const d = new Date(`${day}T12:00:00`);
  d.setDate(d.getDate() + delta);
  return isoDate(d);
}

export default async function SevaSchedulePage({ searchParams }: SchedulePageProps) {
  const { date } = await searchParams;
  const day = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : isoDate(new Date());
  const { ctx } = await requireTenantContext();

  const result = await pujaService().listSevaDay(ctx, day);
  if (!result.ok) return <Alert tone="error">{result.error.message}</Alert>;
  const sevas = result.value;

  const heading = new Date(`${day}T12:00:00`).toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="space-y-6">
      <div>
        <Link href="/pujas" className="text-sm text-muted-foreground hover:text-foreground">
          ← Pujas
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Seva schedule</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The day&apos;s assigned sevas — who performs what, and when.
        </p>
      </div>

      <div className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 shadow-card">
        <Link href={`/pujas/schedule?date=${shiftDay(day, -1)}`} className="text-sm text-primary hover:underline">
          ← Previous day
        </Link>
        <span className="text-sm font-semibold">{heading}</span>
        <Link href={`/pujas/schedule?date=${shiftDay(day, 1)}`} className="text-sm text-primary hover:underline">
          Next day →
        </Link>
      </div>

      {sevas.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <h2 className="font-medium">No sevas scheduled</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Assign a date (and priest) to confirmed bookings from the{' '}
            <Link href="/pujas/bookings" className="text-primary hover:underline">
              bookings queue
            </Link>{' '}
            and they appear here.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card shadow-card">
          {sevas.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-4 p-4">
              <div className="flex items-center gap-4">
                <span className="w-16 text-sm font-semibold tabular-nums">
                  {s.scheduledTime ? formatTime(s.scheduledTime) : '—'}
                </span>
                <div>
                  <div className="flex items-center gap-2 font-medium">
                    {s.pujaName}
                    {s.status === 'completed' ? <Badge variant="success">Done</Badge> : null}
                    {s.status === 'cancelled' ? <Badge variant="outline">Cancelled</Badge> : null}
                  </div>
                  <div className="mt-0.5 text-sm text-muted-foreground">
                    {s.devoteeName}
                    {s.phone ? ` · ${s.phone}` : ''}
                    {s.priestName ? ` · Priest: ${s.priestName}` : ' · No priest assigned'}
                  </div>
                </div>
              </div>
              <span className="font-semibold">{formatMoney(s.amount, s.currency)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
