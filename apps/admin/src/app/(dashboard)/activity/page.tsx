import type { Metadata } from 'next';
import Link from 'next/link';
import { Alert, Badge, Button, Input, Select } from '@templeos/ui';
import { requireTenantContext } from '@/lib/session';
import { auditService } from '@/lib/services';

export const metadata: Metadata = { title: 'Activity' };

interface ActivityPageProps {
  searchParams: Promise<{ entityType?: string; from?: string; to?: string; page?: string }>;
}

function humanizeAction(action: string): string {
  const words = action.replace(/[._]/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function humanizeEntity(entityType: string): string {
  return entityType.replace(/_/g, ' ');
}

const fmt = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Asia/Kolkata',
});

export default async function ActivityPage({ searchParams }: ActivityPageProps) {
  const sp = await searchParams;
  const { ctx } = await requireTenantContext();

  const [result, typesResult] = await Promise.all([
    auditService().listActivity(ctx, sp),
    auditService().listEntityTypes(ctx),
  ]);
  if (!result.ok) {
    return <Alert tone="error">{result.error.message}</Alert>;
  }
  const { items, total, page, pageSize } = result.value;
  const entityTypes = typesResult.ok ? typesResult.value : [];
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const query = (patch: Record<string, string>) => {
    const params = new URLSearchParams();
    if (sp.entityType) params.set('entityType', sp.entityType);
    if (sp.from) params.set('from', sp.from);
    if (sp.to) params.set('to', sp.to);
    for (const [k, v] of Object.entries(patch)) {
      if (v) params.set(k, v);
      else params.delete(k);
    }
    return `/activity?${params.toString()}`;
  };
  const exportHref = `/activity/export.csv?${new URLSearchParams(
    Object.fromEntries(
      Object.entries({ entityType: sp.entityType, from: sp.from, to: sp.to }).filter(
        ([, v]) => v,
      ) as [string, string][],
    ),
  ).toString()}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Activity</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            An immutable record of every action taken in your organisation — for governance and
            accountability.
          </p>
        </div>
        <a
          href={exportHref}
          className="inline-flex h-9.5 items-center rounded-lg border border-input bg-card px-4 text-sm font-medium shadow-card transition-colors hover:bg-muted/60"
        >
          Export CSV
        </a>
      </div>

      <form action="/activity" className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label htmlFor="entityType" className="text-xs text-muted-foreground">
            Type
          </label>
          <Select
            id="entityType"
            name="entityType"
            defaultValue={sp.entityType ?? ''}
            className="w-48"
          >
            <option value="">All types</option>
            {entityTypes.map((t) => (
              <option key={t} value={t}>
                {humanizeEntity(t)}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1">
          <label htmlFor="from" className="text-xs text-muted-foreground">
            From
          </label>
          <Input id="from" name="from" type="date" defaultValue={sp.from ?? ''} />
        </div>
        <div className="space-y-1">
          <label htmlFor="to" className="text-xs text-muted-foreground">
            To
          </label>
          <Input id="to" name="to" type="date" defaultValue={sp.to ?? ''} />
        </div>
        <Button type="submit" variant="outline">
          Filter
        </Button>
        {sp.entityType || sp.from || sp.to ? (
          <Link href="/activity" className="text-sm text-muted-foreground hover:text-foreground">
            Clear
          </Link>
        ) : null}
      </form>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <h2 className="font-medium">No activity</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Nothing matches these filters yet.
          </p>
        </div>
      ) : (
        <>
          <ul className="divide-y divide-border rounded-xl border border-border bg-card shadow-card">
            {items.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-4 p-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{humanizeAction(e.action)}</span>
                    <Badge variant="outline">{humanizeEntity(e.entityType)}</Badge>
                  </div>
                  <div className="mt-0.5 text-sm text-muted-foreground">
                    {e.actorName ?? 'System'}
                  </div>
                </div>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {fmt.format(e.createdAt)}
                </span>
              </li>
            ))}
          </ul>

          {totalPages > 1 ? (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Page {page} of {totalPages} · {total} total
              </span>
              <div className="flex gap-2">
                {page > 1 ? (
                  <Link href={query({ page: String(page - 1) })} className="text-primary hover:underline">
                    ← Previous
                  </Link>
                ) : null}
                {page < totalPages ? (
                  <Link href={query({ page: String(page + 1) })} className="text-primary hover:underline">
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
