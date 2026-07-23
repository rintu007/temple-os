import type { Metadata } from 'next';
import Link from 'next/link';
import { Alert, Badge } from '@templeos/ui';
import { requireTenantContext } from '@/lib/session';
import { volunteerService } from '@/lib/services';

export const metadata: Metadata = { title: 'Volunteers' };

export default async function VolunteersPage() {
  const { ctx } = await requireTenantContext();
  const result = await volunteerService().listOpportunities(ctx);
  if (!result.ok) return <Alert tone="error">{result.error.message}</Alert>;
  const items = result.value;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Volunteers</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Post duties devotees can sign up for. Open opportunities appear on your website.
          </p>
        </div>
        <Link
          href="/volunteers/new"
          className="inline-flex h-9.5 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-card transition-colors hover:bg-primary/90"
        >
          New opportunity
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <h2 className="font-medium">No opportunities yet</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Create a volunteer opportunity — festival seva, kitchen help, crowd management — and
            devotees can sign up from your site.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card shadow-card">
          {items.map((o) => (
            <li key={o.id}>
              <Link
                href={`/volunteers/${o.id}`}
                className="flex flex-wrap items-center justify-between gap-4 p-4 hover:bg-muted/50"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 font-medium">
                    {o.title}
                    {o.status === 'open' ? (
                      <Badge variant="success">Open</Badge>
                    ) : (
                      <Badge variant="outline">Closed</Badge>
                    )}
                  </div>
                  <div className="mt-0.5 text-sm text-muted-foreground">
                    {o.servingOn
                      ? `${new Date(`${o.servingOn}T12:00:00`).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })} · `
                      : ''}
                    {o.signupCount} signed up
                    {o.slotsNeeded > 0 ? ` of ${o.slotsNeeded} needed` : ''}
                  </div>
                </div>
                <span className="text-sm text-muted-foreground">View →</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
