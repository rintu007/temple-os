import type { Metadata } from 'next';
import Link from 'next/link';
import { Alert, Button, cn, formatMoney } from '@templeos/ui';
import { cancelMembershipAction } from '@/features/membership/actions';
import { requireTenantContext } from '@/lib/session';
import { membershipService } from '@/lib/services';

export const metadata: Metadata = { title: 'Members' };

interface MembersPageProps {
  searchParams: Promise<{ status?: string; page?: string }>;
}

const STATUS_TABS = ['active', 'expired', 'cancelled', 'all'] as const;

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(`${iso}T12:00:00`).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default async function MembersPage({ searchParams }: MembersPageProps) {
  const { status: rawStatus, page } = await searchParams;
  const status = STATUS_TABS.includes(rawStatus as (typeof STATUS_TABS)[number])
    ? (rawStatus as (typeof STATUS_TABS)[number])
    : 'active';
  const { ctx } = await requireTenantContext();

  const result = await membershipService().listMembers(ctx, { status, page: page ?? 1 });
  if (!result.ok) {
    return <Alert tone="error">{result.error.message}</Alert>;
  }
  const { items, total, page: currentPage, pageSize } = result.value;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-6">
      <div>
        <Link href="/membership" className="text-sm text-muted-foreground hover:text-foreground">
          ← Membership
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Members</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {total} member{total === 1 ? '' : 's'} in this view.
        </p>
      </div>

      <div className="flex w-fit gap-1 rounded-lg border border-border p-1 text-sm">
        {STATUS_TABS.map((s) => (
          <Link
            key={s}
            href={`/membership/members?status=${s}`}
            className={cn(
              'rounded-md px-4 py-1.5 capitalize',
              status === s ? 'bg-muted font-medium' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {s}
          </Link>
        ))}
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <h2 className="font-medium">No {status === 'all' ? '' : status} members</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Members appear here once devotees join a plan on your website.
          </p>
        </div>
      ) : (
        <>
          <ul className="divide-y divide-border rounded-xl border border-border">
            {items.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-4 p-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 font-medium">
                    {m.memberName}
                    <span
                      className={cn(
                        'rounded px-1.5 py-0.5 text-xs font-medium capitalize',
                        m.status === 'cancelled'
                          ? 'bg-muted text-muted-foreground'
                          : m.isExpired
                            ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200'
                            : 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200',
                      )}
                    >
                      {m.status === 'cancelled' ? 'cancelled' : m.isExpired ? 'expired' : m.status}
                    </span>
                  </div>
                  <div className="mt-0.5 text-sm text-muted-foreground">
                    {m.planName}
                    {m.phone ? ` · ${m.phone}` : ''}
                    {m.email ? ` · ${m.email}` : ''} · until {formatDate(m.expiresOn)}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold">{formatMoney(m.amount, m.currency)}</span>
                  {m.status === 'active' && !m.isExpired ? (
                    <form action={cancelMembershipAction.bind(null, m.id)}>
                      <Button variant="ghost" size="sm" type="submit">
                        Cancel
                      </Button>
                    </form>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>

          {totalPages > 1 ? (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Page {currentPage} of {totalPages} · {total} total
              </span>
              <div className="flex gap-2">
                {currentPage > 1 ? (
                  <Link
                    href={`/membership/members?status=${status}&page=${currentPage - 1}`}
                    className="text-primary hover:underline"
                  >
                    ← Previous
                  </Link>
                ) : null}
                {currentPage < totalPages ? (
                  <Link
                    href={`/membership/members?status=${status}&page=${currentPage + 1}`}
                    className="text-primary hover:underline"
                  >
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
