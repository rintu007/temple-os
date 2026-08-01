import type { Metadata } from 'next';
import { CheckCircle2 } from 'lucide-react';
import { Alert, Badge, Button, cn } from '@templeos/ui';
import { billingService, planService } from '@/lib/services';
import { requireTenantContext } from '@/lib/session';
import { manageBillingAction, upgradeAction } from '@/features/billing/actions';

export const metadata: Metadata = { title: 'Billing' };

function daysLeft(date: Date): number {
  return Math.max(0, Math.ceil((date.getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
}

export default async function BillingPage() {
  const { ctx } = await requireTenantContext();
  const [result, plans] = await Promise.all([
    billingService().getStatus(ctx),
    planService().listPlans(),
  ]);

  if (!result.ok) {
    return <Alert tone="error">{result.error.message}</Alert>;
  }
  const status = result.value;
  const planByKey = new Map(plans.map((p) => [p.key, p]));
  const currentPlanKey = status?.plan ?? null;
  const currentPlanEntry = currentPlanKey ? planByKey.get(currentPlanKey) : undefined;
  const onActivePaidPlan = status?.status === 'active';
  const displayPlans = plans.filter((p) => !p.isTrialDefault);

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
              <div className="mt-1 text-xl font-semibold">{currentPlanEntry?.name ?? currentPlanKey}</div>
            </div>
            <Badge variant={onActivePaidPlan ? 'success' : status.isTrialExpired ? 'destructive' : 'default'}>
              {status.isTrialExpired ? 'Trial expired' : status.status}
            </Badge>
          </div>

          {currentPlanEntry?.isTrialDefault && status.trialEndsAt ? (
            <p className="mt-3 text-sm text-muted-foreground">
              {status.isTrialExpired
                ? "Your trial has ended — you're on Starter until you upgrade."
                : `${daysLeft(status.trialEndsAt)} day${daysLeft(status.trialEndsAt) === 1 ? '' : 's'} left in your trial.`}
            </p>
          ) : null}

          {onActivePaidPlan && status.currentPeriodEnd ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Renews{' '}
              {status.currentPeriodEnd.toLocaleDateString('en-US', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
              .
            </p>
          ) : null}

          {status.hasStripeCustomer ? (
            <form action={manageBillingAction} className="mt-5">
              <Button type="submit" variant="outline">
                Manage billing
              </Button>
            </form>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        {displayPlans.map((plan) => {
          const isCurrent = onActivePaidPlan && currentPlanKey === plan.key;
          const configured = plan.isPurchasable && billingService().isConfigured(plan);
          const comparingFromPaid = !!currentPlanEntry && !currentPlanEntry.isTrialDefault && currentPlanEntry.priceUsd !== null;

          return (
            <div
              key={plan.key}
              className={cn(
                'rounded-xl border bg-card p-6 shadow-card',
                isCurrent ? 'border-primary ring-1 ring-primary' : 'border-border',
              )}
            >
              <div className="flex items-center justify-between">
                <div className="text-lg font-semibold">{plan.name}</div>
                {isCurrent ? <Badge variant="success">Current</Badge> : null}
              </div>
              <div className="mt-1 text-2xl font-semibold">
                {plan.priceUsd === 0 ? 'Free' : `$${plan.priceUsd}`}
                {plan.priceUsd ? <span className="text-sm font-normal text-muted-foreground">/mo</span> : null}
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{plan.description}</p>
              <ul className="mt-4 space-y-2 text-sm">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                    {f}
                  </li>
                ))}
              </ul>
              {plan.isPurchasable && !isCurrent ? (
                <form action={upgradeAction.bind(null, plan.key)} className="mt-5">
                  <Button type="submit" className="w-full" disabled={!configured}>
                    {comparingFromPaid
                      ? (plan.priceUsd ?? 0) > (currentPlanEntry?.priceUsd ?? 0)
                        ? `Upgrade to ${plan.name}`
                        : `Switch to ${plan.name}`
                      : `Choose ${plan.name}`}
                  </Button>
                  {!configured ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Online upgrade isn&apos;t switched on yet — contact us in the meantime.
                    </p>
                  ) : null}
                </form>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
