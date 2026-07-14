import type { Metadata } from 'next';
import Link from 'next/link';
import { Alert } from '@templeos/ui';
import { requireTenantContext } from '@/lib/session';
import { templeService } from '@/lib/services';

export const metadata: Metadata = { title: 'Temples' };

export default async function TemplesPage() {
  const { ctx } = await requireTenantContext();
  const result = await templeService().listTemples(ctx);

  if (!result.ok) {
    return <Alert tone="error">{result.error.message}</Alert>;
  }
  const temples = result.value;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Temples</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Temples in your organization, shown on your public website.
          </p>
        </div>
        <Link
          href="/temples/new"
          className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Add temple
        </Link>
      </div>

      {temples.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <h2 className="font-medium">No temples yet</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Add your first temple to publish its profile and daily schedule on your website.
          </p>
          <Link
            href="/temples/new"
            className="mt-4 inline-block text-sm font-medium text-primary hover:underline"
          >
            Add your first temple →
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {temples.map((t) => (
            <li key={t.id}>
              <Link href={`/temples/${t.id}`} className="flex items-center justify-between p-4 hover:bg-muted/50">
                <div>
                  <div className="font-medium">{t.name}</div>
                  <div className="mt-0.5 text-sm text-muted-foreground">
                    {[t.deity, t.city].filter(Boolean).join(' · ') || 'No details yet'}
                  </div>
                </div>
                <span className="text-sm text-muted-foreground">Edit →</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
