import type { Metadata } from 'next';
import Link from 'next/link';
import type { OfficeBearerSummary } from '@templeos/core';
import { Alert, Badge, cn } from '@templeos/ui';
import { requireTenantContext } from '@/lib/session';
import { officerService } from '@/lib/services';

export const metadata: Metadata = { title: 'Office bearers' };

function formatDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(`${iso}T12:00:00`).toLocaleDateString('en-IN', {
    month: 'short',
    year: 'numeric',
  });
}

export default async function OfficersPage() {
  const { ctx } = await requireTenantContext();
  const result = await officerService().listOfficers(ctx, 'all');
  if (!result.ok) {
    return <Alert tone="error">{result.error.message}</Alert>;
  }
  const officers = result.value;
  const active = officers.filter((o) => o.isActive);
  const former = officers.filter((o) => !o.isActive);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Office bearers</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            The trustees and committee members who run the temple — the statutory register.
          </p>
        </div>
        <div className="flex gap-2">
          <a
            href="/officers/export.csv"
            className="inline-flex h-9.5 items-center rounded-lg border border-input bg-card px-4 text-sm font-medium shadow-card transition-colors hover:bg-muted/60"
          >
            Export CSV
          </a>
          <Link
            href="/officers/new"
            className="inline-flex h-9.5 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-card transition-colors hover:bg-primary/90"
          >
            Add office bearer
          </Link>
        </div>
      </div>

      {officers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <h2 className="font-medium">No office bearers yet</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Add your trustees and committee members to maintain the governance register.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          <OfficerList officers={active} />
          {former.length > 0 ? (
            <div>
              <h2 className="mb-2 text-sm font-medium text-muted-foreground">Former</h2>
              <OfficerList officers={former} />
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function OfficerList({ officers }: { officers: OfficeBearerSummary[] }) {
  if (officers.length === 0) {
    return <p className="text-sm text-muted-foreground">No current office bearers.</p>;
  }
  return (
    <ul className="divide-y divide-border rounded-xl border border-border bg-card shadow-card">
      {officers.map((o) => (
        <li key={o.id}>
          <Link
            href={`/officers/${o.id}`}
            className={cn(
              'flex items-center justify-between gap-4 p-4 hover:bg-muted/50',
              !o.isActive && 'opacity-60',
            )}
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2 font-medium">
                {o.name}
                <Badge variant={o.isActive ? 'primary' : 'outline'}>{o.designation}</Badge>
              </div>
              <div className="mt-0.5 truncate text-sm text-muted-foreground">
                {o.body ? `${o.body} · ` : ''}
                {o.phone ?? o.email ?? ''}
              </div>
            </div>
            <div className="shrink-0 text-right text-xs text-muted-foreground">
              {o.termStartsOn ? formatDate(o.termStartsOn) : ''}
              {o.termEndsOn ? ` – ${formatDate(o.termEndsOn)}` : o.termStartsOn ? ' – present' : ''}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
