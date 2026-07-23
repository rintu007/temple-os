import type { Metadata } from 'next';
import Link from 'next/link';
import { Alert, Badge, Button, cn, formatMoney } from '@templeos/ui';
import {
  cancelFacilityBookingAction,
  confirmBookingAction,
} from '@/features/facilities/actions';
import { ConfirmButton } from '@/features/facilities/components/confirm-button';
import { requireTenantContext } from '@/lib/session';
import { facilityService } from '@/lib/services';

export const metadata: Metadata = { title: 'Facility bookings' };

interface BookingsPageProps {
  searchParams: Promise<{ status?: string }>;
}

const TABS = ['requested', 'confirmed', 'cancelled', 'all'] as const;
const STATUS_VARIANT = {
  requested: 'warning',
  confirmed: 'success',
  cancelled: 'outline',
} as const;

export default async function FacilityBookingsPage({ searchParams }: BookingsPageProps) {
  const { status: raw } = await searchParams;
  const status = TABS.includes(raw as (typeof TABS)[number])
    ? (raw as (typeof TABS)[number])
    : 'requested';
  const { ctx } = await requireTenantContext();

  const result = await facilityService().listBookings(ctx, status);
  if (!result.ok) return <Alert tone="error">{result.error.message}</Alert>;
  const bookings = result.value;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/facilities" className="text-sm text-muted-foreground hover:text-foreground">
          ← Facilities
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Booking requests</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Confirm a request to reserve the date — a date can only be confirmed once per facility.
        </p>
      </div>

      <div className="flex w-fit gap-1 rounded-lg border border-border p-1 text-sm">
        {TABS.map((s) => (
          <Link
            key={s}
            href={`/facilities/bookings?status=${s}`}
            className={cn(
              'rounded-md px-4 py-1.5 capitalize',
              status === s ? 'bg-muted font-medium' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {s}
          </Link>
        ))}
      </div>

      {bookings.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <h2 className="font-medium">No {status === 'all' ? '' : status} bookings</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Requests from your website appear here.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card shadow-card">
          {bookings.map((b) => (
            <li key={b.id} className="flex flex-wrap items-center justify-between gap-4 p-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 font-medium">
                  {b.facilityName}
                  <Badge variant={STATUS_VARIANT[b.status]} className="capitalize">
                    {b.status}
                  </Badge>
                </div>
                <div className="mt-0.5 text-sm text-muted-foreground">
                  {new Date(`${b.eventDate}T12:00:00`).toLocaleDateString('en-IN', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}{' '}
                  · {b.bookerName}
                  {b.phone ? ` · ${b.phone}` : ''}
                  {b.purpose ? ` · ${b.purpose}` : ''}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-semibold">{formatMoney(b.amount, b.currency)}</span>
                {b.status === 'requested' ? (
                  <>
                    <ConfirmButton action={confirmBookingAction.bind(null, b.id)} />
                    <form action={cancelFacilityBookingAction.bind(null, b.id)}>
                      <Button variant="ghost" size="sm" type="submit">
                        Decline
                      </Button>
                    </form>
                  </>
                ) : null}
                {b.status === 'confirmed' ? (
                  <form action={cancelFacilityBookingAction.bind(null, b.id)}>
                    <Button variant="ghost" size="sm" type="submit">
                      Cancel
                    </Button>
                  </form>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
