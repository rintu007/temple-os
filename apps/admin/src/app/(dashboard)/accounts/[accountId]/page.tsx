import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge, Button, cn, formatMoney } from '@templeos/ui';
import { setAccountActiveAction, updateAccountAction } from '@/features/accounts/actions';
import { AccountForm } from '@/features/accounts/components/account-form';
import { requireTenantContext } from '@/lib/session';
import { accountService } from '@/lib/services';

interface AccountDetailProps {
  params: Promise<{ accountId: string }>;
}

export const metadata: Metadata = { title: 'Account' };

export default async function AccountDetailPage({ params }: AccountDetailProps) {
  const { accountId } = await params;
  const { ctx, membership } = await requireTenantContext();

  const result = await accountService().getPassbook(ctx, accountId);
  if (!result.ok) notFound();
  const { account, currency, movements } = result.value;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/accounts" className="text-sm text-muted-foreground hover:text-foreground">
          ← Accounts
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
              {account.name}
              <Badge variant="outline">{account.type === 'cash' ? 'Cash' : 'Bank'}</Badge>
              {!account.isActive ? <Badge variant="outline">Archived</Badge> : null}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {account.type === 'cash'
                ? 'Cash in hand'
                : [account.bankName, account.accountNumberMasked].filter(Boolean).join(' · ') ||
                  'Bank account'}
            </p>
          </div>
          <div className="text-right">
            <div
              className={cn(
                'text-2xl font-semibold tabular-nums',
                Number(account.balance) < 0 && 'text-destructive',
              )}
            >
              {formatMoney(account.balance, currency)}
            </div>
            <div className="text-xs text-muted-foreground">
              opening {formatMoney(account.openingBalance, currency)} ·{' '}
              {formatMoney(account.received, currency)} in ·{' '}
              {formatMoney(account.paid, currency)} out
              {Number(account.transfersIn) > 0 || Number(account.transfersOut) > 0 ? (
                <>
                  {' · '}
                  {formatMoney(account.transfersIn, currency)} ⇄ in ·{' '}
                  {formatMoney(account.transfersOut, currency)} ⇄ out
                </>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <Link
          href={`/accounts/${account.id}/reconcile`}
          className="inline-flex h-9 items-center rounded-lg border border-input bg-card px-4 text-sm font-medium shadow-card transition-colors hover:bg-muted/60"
        >
          Reconcile
        </Link>
      </div>

      <section className="rounded-xl border border-border bg-card shadow-card">
        <div className="border-b border-border px-5 py-3 text-sm font-semibold">Passbook</div>
        {movements.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted-foreground">
            No movements yet. Tag donations and expenses to this account when recording them.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground uppercase">
                  <th className="px-5 py-2 font-medium">Date</th>
                  <th className="px-5 py-2 font-medium">Particulars</th>
                  <th className="px-5 py-2 text-right font-medium">In</th>
                  <th className="px-5 py-2 text-right font-medium">Out</th>
                  <th className="px-5 py-2 text-right font-medium">Balance</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m) => (
                  <tr key={`${m.kind}-${m.id}`} className="border-b border-border/60">
                    <td className="px-5 py-2 whitespace-nowrap text-muted-foreground">
                      {m.at.toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="px-5 py-2">
                      <span className="font-medium">{m.ref}</span>
                      <span className="text-muted-foreground"> · {m.party}</span>
                    </td>
                    <td className="px-5 py-2 text-right tabular-nums text-success">
                      {m.kind === 'receipt' || m.kind === 'transfer_in'
                        ? formatMoney(m.amount, currency)
                        : ''}
                    </td>
                    <td className="px-5 py-2 text-right tabular-nums text-destructive">
                      {m.kind === 'payment' || m.kind === 'transfer_out'
                        ? formatMoney(m.amount, currency)
                        : ''}
                    </td>
                    <td className="px-5 py-2 text-right tabular-nums font-medium">
                      {formatMoney(m.balance, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-border bg-card p-6 shadow-card">
        <h2 className="mb-4 text-sm font-medium text-muted-foreground">Account details</h2>
        <AccountForm
          action={updateAccountAction.bind(null, accountId)}
          account={account}
          currency={membership.currency}
          submitLabel="Save changes"
        />
      </section>

      <section className="rounded-xl border border-border bg-card p-6 shadow-card">
        <h2 className="text-sm font-medium text-muted-foreground">
          {account.isActive ? 'Archive account' : 'Reactivate account'}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {account.isActive
            ? 'Hide this account from the tagging dropdowns. Its history and balance are kept.'
            : 'Return this account to the tagging dropdowns.'}
        </p>
        <form action={setAccountActiveAction.bind(null, accountId, !account.isActive)} className="mt-4">
          <Button variant={account.isActive ? 'destructive' : 'outline'} size="sm" type="submit">
            {account.isActive ? 'Archive' : 'Reactivate'}
          </Button>
        </form>
      </section>
    </div>
  );
}
