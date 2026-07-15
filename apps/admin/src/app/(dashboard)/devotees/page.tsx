import type { Metadata } from 'next';
import Link from 'next/link';
import { Alert, Button, Input } from '@templeos/ui';
import { requireTenantContext } from '@/lib/session';
import { devoteeService } from '@/lib/services';

export const metadata: Metadata = { title: 'Devotees' };

interface DevoteesPageProps {
  searchParams: Promise<{ q?: string; page?: string }>;
}

export default async function DevoteesPage({ searchParams }: DevoteesPageProps) {
  const { q, page } = await searchParams;
  const { ctx } = await requireTenantContext();

  const result = await devoteeService().listDevotees(ctx, { search: q ?? '', page: page ?? 1 });
  if (!result.ok) {
    return <Alert tone="error">{result.error.message}</Alert>;
  }
  const { items, total, page: currentPage, pageSize } = result.value;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageHref = (p: number) => `/devotees?${new URLSearchParams({ ...(q ? { q } : {}), page: String(p) })}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Devotees</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {total} active devotee{total === 1 ? '' : 's'} in your community.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/devotees/import"
            className="inline-flex h-10 items-center rounded-md border border-border px-4 text-sm font-medium hover:bg-muted"
          >
            Import CSV
          </Link>
          <Link
            href="/devotees/new"
            className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Add devotee
          </Link>
        </div>
      </div>

      <form action="/devotees" className="flex max-w-md gap-2">
        <Input name="q" placeholder="Search by name, phone or email…" defaultValue={q ?? ''} />
        <Button type="submit" variant="outline">
          Search
        </Button>
      </form>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <h2 className="font-medium">{q ? 'No matches' : 'No devotees yet'}</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            {q
              ? `Nothing found for “${q}”. Try a different search.`
              : 'Start building your community directory — add your first devotee.'}
          </p>
          {!q && (
            <Link
              href="/devotees/new"
              className="mt-4 inline-block text-sm font-medium text-primary hover:underline"
            >
              Add your first devotee →
            </Link>
          )}
        </div>
      ) : (
        <>
          <ul className="divide-y divide-border rounded-xl border border-border">
            {items.map((d) => (
              <li key={d.id}>
                <Link
                  href={`/devotees/${d.id}`}
                  className="flex items-center justify-between p-4 hover:bg-muted/50"
                >
                  <div>
                    <div className="font-medium">{d.fullName}</div>
                    <div className="mt-0.5 text-sm text-muted-foreground">
                      {[d.phone, d.email, d.familyName, d.city].filter(Boolean).join(' · ') ||
                        'No contact details'}
                    </div>
                  </div>
                  <span className="text-sm text-muted-foreground">Edit →</span>
                </Link>
              </li>
            ))}
          </ul>

          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Page {currentPage} of {totalPages}
              </span>
              <div className="flex gap-2">
                {currentPage > 1 && (
                  <Link href={pageHref(currentPage - 1)} className="text-primary hover:underline">
                    ← Previous
                  </Link>
                )}
                {currentPage < totalPages && (
                  <Link href={pageHref(currentPage + 1)} className="text-primary hover:underline">
                    Next →
                  </Link>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
