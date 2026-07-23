import type { Metadata } from 'next';
import Link from 'next/link';
import { Alert, Badge, Button } from '@templeos/ui';
import { togglePriestAction } from '@/features/pujas/actions';
import { PriestForm } from '@/features/pujas/components/priest-form';
import { requireTenantContext } from '@/lib/session';
import { pujaService } from '@/lib/services';

export const metadata: Metadata = { title: 'Priests' };

export default async function PriestsPage() {
  const { ctx } = await requireTenantContext();
  const result = await pujaService().listPriests(ctx);
  if (!result.ok) return <Alert tone="error">{result.error.message}</Alert>;
  const priests = result.value;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/pujas" className="text-sm text-muted-foreground hover:text-foreground">
          ← Pujas
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Priests</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your pujari roster — assign them to booked sevas from the bookings queue.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card shadow-card p-6">
        <PriestForm />
      </div>

      {priests.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <h2 className="font-medium">No priests yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Add your pujaris above to start scheduling sevas.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card shadow-card">
          {priests.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-4 p-4">
              <div>
                <div className="flex items-center gap-2 font-medium">
                  {p.name}
                  {!p.isActive ? <Badge variant="outline">Inactive</Badge> : null}
                </div>
                <div className="mt-0.5 text-sm text-muted-foreground">
                  {[p.phone, p.specialty].filter(Boolean).join(' · ') || 'No details'}
                </div>
              </div>
              <form action={togglePriestAction.bind(null, p.id, !p.isActive)}>
                <Button variant="ghost" size="sm" type="submit">
                  {p.isActive ? 'Deactivate' : 'Reactivate'}
                </Button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
