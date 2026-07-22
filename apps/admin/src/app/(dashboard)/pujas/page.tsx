import type { Metadata } from 'next';
import Link from 'next/link';
import { Alert, cn, formatMoney } from '@templeos/ui';
import { requireTenantContext } from '@/lib/session';
import { pujaService } from '@/lib/services';

export const metadata: Metadata = { title: 'Pujas' };

export default async function PujasPage() {
  const { ctx } = await requireTenantContext();
  const result = await pujaService().listPujaTypes(ctx);
  if (!result.ok) {
    return <Alert tone="error">{result.error.message}</Alert>;
  }
  const types = result.value;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Pujas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pujas devotees can book and pay for on your website.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/pujas/bookings"
            className="inline-flex h-9.5 items-center rounded-lg border border-input bg-card px-4 text-sm font-medium shadow-card transition-colors hover:bg-muted/60"
          >
            View bookings
          </Link>
          <Link
            href="/pujas/new"
            className="inline-flex h-9.5 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-card transition-colors hover:bg-primary/90"
          >
            Add puja
          </Link>
        </div>
      </div>

      {types.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <h2 className="font-medium">No pujas yet</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Add a puja with its price to let devotees book it online.
          </p>
          <Link
            href="/pujas/new"
            className="mt-4 inline-block text-sm font-medium text-primary hover:underline"
          >
            Add your first puja →
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card shadow-card">
          {types.map((t) => (
            <li key={t.id}>
              <Link
                href={`/pujas/${t.id}`}
                className={cn(
                  'flex items-center justify-between gap-4 p-4 hover:bg-muted/50',
                  !t.isActive && 'opacity-50',
                )}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 font-medium">
                    {t.name}
                    {!t.isActive ? (
                      <span className="rounded bg-muted px-1.5 py-0.5 text-xs uppercase text-muted-foreground">
                        Hidden
                      </span>
                    ) : null}
                  </div>
                  {t.description ? (
                    <div className="mt-0.5 truncate text-sm text-muted-foreground">
                      {t.description}
                    </div>
                  ) : null}
                </div>
                <span className="whitespace-nowrap font-semibold">
                  {formatMoney(t.price, t.currency)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
