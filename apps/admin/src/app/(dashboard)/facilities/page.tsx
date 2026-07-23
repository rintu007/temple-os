import type { Metadata } from 'next';
import Link from 'next/link';
import { Alert, Badge, Button, formatMoney } from '@templeos/ui';
import { toggleFacilityAction } from '@/features/facilities/actions';
import { FacilityForm } from '@/features/facilities/components/facility-form';
import { requireTenantContext } from '@/lib/session';
import { facilityService } from '@/lib/services';

export const metadata: Metadata = { title: 'Facilities' };

export default async function FacilitiesPage() {
  const { ctx, membership } = await requireTenantContext();
  const result = await facilityService().listFacilities(ctx);
  if (!result.ok) return <Alert tone="error">{result.error.message}</Alert>;
  const facilities = result.value;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Facilities</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Bookable halls and rooms. Devotees request dates on your website; you confirm them.
          </p>
        </div>
        <Link
          href="/facilities/bookings"
          className="inline-flex h-9.5 items-center rounded-lg border border-input bg-card px-4 text-sm font-medium shadow-card transition-colors hover:bg-muted/60"
        >
          Booking requests
        </Link>
      </div>

      <div className="rounded-xl border border-border bg-card shadow-card p-6">
        <h2 className="mb-4 text-sm font-medium text-muted-foreground">Add a facility</h2>
        <FacilityForm currency={membership.currency} />
      </div>

      {facilities.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <h2 className="font-medium">No facilities yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Add a marriage hall, community room or guest house above.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card shadow-card">
          {facilities.map((f) => (
            <li key={f.id} className="flex flex-wrap items-center justify-between gap-4 p-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 font-medium">
                  {f.name}
                  {!f.isActive ? <Badge variant="outline">Inactive</Badge> : null}
                </div>
                <div className="mt-0.5 text-sm text-muted-foreground">
                  {formatMoney(f.rentAmount, f.currency)}
                  {f.capacity ? ` · up to ${f.capacity} guests` : ''}
                </div>
              </div>
              <form action={toggleFacilityAction.bind(null, f.id, !f.isActive)}>
                <Button variant="ghost" size="sm" type="submit">
                  {f.isActive ? 'Deactivate' : 'Reactivate'}
                </Button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
