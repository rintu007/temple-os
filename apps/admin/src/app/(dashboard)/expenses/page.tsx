import type { Metadata } from 'next';
import Link from 'next/link';
import { Alert, Badge, Button, Input, cn, formatMoney } from '@templeos/ui';
import { requireTenantContext } from '@/lib/session';
import { expenseService } from '@/lib/services';

export const metadata: Metadata = { title: 'Expenses' };

interface ExpensesPageProps {
  searchParams: Promise<{ q?: string; page?: string }>;
}

const METHOD_LABELS: Record<string, string> = {
  cash: 'Cash',
  upi: 'UPI',
  bank_transfer: 'Bank',
  card: 'Card',
  cheque: 'Cheque',
  other: 'Other',
};

export default async function ExpensesPage({ searchParams }: ExpensesPageProps) {
  const { q, page } = await searchParams;
  const { ctx } = await requireTenantContext();

  const [result, stats, pendingCount] = await Promise.all([
    expenseService().listExpenses(ctx, { search: q ?? '', page: page ?? 1 }),
    expenseService().getStats(ctx),
    expenseService().getPendingApprovalCount(ctx),
  ]);
  if (!result.ok) {
    return <Alert tone="error">{result.error.message}</Alert>;
  }
  const pending = pendingCount.ok ? pendingCount.value : 0;
  const { items, total, page: currentPage, pageSize } = result.value;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageHref = (p: number) =>
    `/expenses?${new URLSearchParams({ ...(q ? { q } : {}), page: String(p) })}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Expenses</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every expense gets a sequential voucher number. Records are never deleted — only
            voided.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/expenses/approvals"
            className="inline-flex h-9.5 items-center gap-2 rounded-lg border border-input bg-card px-4 text-sm font-medium shadow-card transition-colors hover:bg-muted/60"
          >
            Approvals
            {pending > 0 ? (
              <Badge variant="warning">{pending}</Badge>
            ) : null}
          </Link>
          <Link
            href="/expenses/new"
            className="inline-flex h-9.5 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-card transition-colors hover:bg-primary/90"
          >
            Record expense
          </Link>
        </div>
      </div>

      {stats.ok ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-card shadow-card p-5">
            <div className="text-sm text-muted-foreground">This month</div>
            <div className="mt-1 text-2xl font-semibold">
              {formatMoney(stats.value.monthTotal, stats.value.currency)}
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card shadow-card p-5">
            <div className="text-sm text-muted-foreground">Vouchers this month</div>
            <div className="mt-1 text-2xl font-semibold">{stats.value.monthCount}</div>
          </div>
          <div className="rounded-xl border border-border bg-card shadow-card p-5">
            <div className="text-sm text-muted-foreground">All time</div>
            <div className="mt-1 text-2xl font-semibold">
              {formatMoney(stats.value.allTimeTotal, stats.value.currency)}
            </div>
          </div>
        </div>
      ) : null}

      <form action="/expenses" className="flex max-w-md gap-2">
        <Input name="q" placeholder="Search by payee or voucher no…" defaultValue={q ?? ''} />
        <Button type="submit" variant="outline">
          Search
        </Button>
      </form>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <h2 className="font-medium">{q ? 'No matches' : 'No expenses yet'}</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            {q
              ? `Nothing found for “${q}”.`
              : 'Record your first expense — supplies, salaries, utilities and more.'}
          </p>
        </div>
      ) : (
        <>
          <ul className="divide-y divide-border rounded-xl border border-border bg-card shadow-card">
            {items.map((e) => (
              <li key={e.id}>
                <Link
                  href={`/expenses/${e.id}`}
                  className={cn(
                    'flex items-center justify-between gap-4 p-4 hover:bg-muted/50',
                    e.status === 'void' && 'opacity-50',
                  )}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 font-medium">
                      {e.paidTo}
                      {e.status === 'void' ? <Badge variant="outline">VOID</Badge> : null}
                      {e.approvalStatus === 'pending' ? (
                        <Badge variant="warning">Pending approval</Badge>
                      ) : e.approvalStatus === 'rejected' ? (
                        <Badge variant="destructive">Rejected</Badge>
                      ) : null}
                    </div>
                    <div className="mt-0.5 truncate text-sm text-muted-foreground">
                      {e.voucherNumber} · {METHOD_LABELS[e.method] ?? e.method}
                      {e.categoryName ? ` · ${e.categoryName}` : ''} ·{' '}
                      {e.spentAt.toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </div>
                  </div>
                  <div className="font-semibold whitespace-nowrap">
                    {formatMoney(e.amount, e.currency)}
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Page {currentPage} of {totalPages} · {total} total
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
