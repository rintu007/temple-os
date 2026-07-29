import type { Metadata } from 'next';
import { CheckCircle2 } from 'lucide-react';
import { PLAN_CATALOG } from '@templeos/validators';
import { Alert, Badge, Button } from '@templeos/ui';
import { billingService } from '@/lib/services';
import { requireTenantContext } from '@/lib/session';
import { manageBillingAction, upgradeToProAction } from '@/features/billing/actions';

export const metadata: Metadata = { title: 'Billing' };

function daysLeft(date: Date): number {
  return Math.max(0, Math.ceil((date.getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
}

export default async function BillingPage() {
  const { ctx } = await requireTenantContext();
  const [result, configured] = await Promise.all([
    billingService().getStatus(ctx),
    Promise.resolve(billingService().isConfigured()),
  ]);

  if (!result.ok) {
    return <Alert tone="error">{result.error.message}</Alert>;
  }
  const status = result.value;
  const pro = PLAN_CATALOG.pro;
  const trial = PLAN_CATALOG.trial;
  const onPaidPlan = status?.plan === 'pro' && status.status === 'active';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Billing</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your TempleOS subscription — separate from devotee donations, which always go straight
          to your temple, never through us.
        </p>
      </div>

      {status ? (
        <div className="max-w-2xl rounded-xl border border-border bg-card p-6 shadow-card">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-muted-foreground">Current plan</div>
              <div className="mt-1 text-xl font-semibold">
                {status.plan === 'pro' ? pro.name : trial.name}
              </div>
            </div>
            <Badge variant={onPaidPlan ? 'success' : status.isTrialExpired ? 'destructive' : 'default'}>
              {status.isTrialExpired ? 'Trial expired' : status.status}
            </Badge>
          </div>

          {status.plan === 'trial' && status.trialEndsAt ? (
            <p className="mt-3 text-sm text-muted-foreground">
              {status.isTrialExpired
                ? 'Your trial has ended — upgrade to keep using TempleOS.'
                : `${daysLeft(status.trialEndsAt)} day${daysLeft(status.trialEndsAt) === 1 ? '' : 's'} left in your trial.`}
            </p>
          ) : null}

          {status.plan === 'pro' && status.currentPeriodEnd ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Renews {status.currentPeriodEnd.toLocaleDateString('en-US', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
              .
            </p>
          ) : null}

          <div className="mt-5 flex gap-3">
            {!onPaidPlan ? (
              <form action={upgradeToProAction}>
                <Button type="submit" disabled={!configured}>
                  Upgrade to Pro — ${pro.priceUsd}/mo
                </Button>
              </form>
            ) : null}
            {status.hasStripeCustomer ? (
              <form action={manageBillingAction}>
                <Button type="submit" variant="outline" disabled={!configured}>
                  Manage billing
                </Button>
              </form>
            ) : null}
          </div>

          {!configured ? (
            <p className="mt-4 text-xs text-muted-foreground">
              Online upgrade isn&apos;t switched on yet — contact us to go Pro in the meantime.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="max-w-2xl rounded-xl border border-border bg-card p-6 shadow-card">
        <div className="text-sm font-medium">What&apos;s included</div>
        <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
          {pro.features.map((f) => (
            <li key={f} className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" aria-hidden />
              {f}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
