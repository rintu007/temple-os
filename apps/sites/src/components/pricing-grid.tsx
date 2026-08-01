import type { PlanCatalogEntry } from '@templeos/validators';
import { cn } from '@templeos/ui';

interface PricingGridProps {
  plans: PlanCatalogEntry[];
  signupUrl: string;
  /** Homepage teaser: hides seat-limit/module rows, caps feature bullets. */
  compact?: boolean;
}

function priceLabel(plan: PlanCatalogEntry): string {
  if (plan.isTrialDefault) return 'Free';
  if (plan.priceUsd === null) return 'Custom';
  if (plan.priceUsd === 0) return 'Free';
  return `$${plan.priceUsd}`;
}

function ctaLabel(plan: PlanCatalogEntry): string {
  if (plan.isTrialDefault) return 'Start free trial';
  if (plan.priceUsd === 0) return 'Get started free';
  return `Choose ${plan.name}`;
}

export function PricingGrid({ plans, signupUrl, compact = false }: PricingGridProps) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {plans.map((plan) => (
        <div
          key={plan.key}
          className={cn(
            'flex flex-col rounded-2xl border bg-card p-6 shadow-card transition-shadow hover:shadow-raised',
            plan.isPurchasable ? 'border-primary/40' : 'border-border',
          )}
        >
          <h3 className="font-medium">{plan.name}</h3>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight">
              {priceLabel(plan)}
            </span>
            {plan.priceUsd !== null && plan.priceUsd > 0 && !plan.isTrialDefault ? (
              <span className="text-sm text-muted-foreground">/mo</span>
            ) : null}
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{plan.description}</p>

          <ul className="mt-5 space-y-2 text-sm">
            {(compact ? plan.features.slice(0, 3) : plan.features).map((f) => (
              <li key={f} className="flex items-start gap-2">
                <span aria-hidden className="mt-0.5 text-primary">
                  ✓
                </span>
                <span className="text-foreground/90">{f}</span>
              </li>
            ))}
          </ul>

          <a
            href={signupUrl}
            className={cn(
              'mt-6 inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold transition-colors',
              plan.isPurchasable || plan.isTrialDefault
                ? 'bg-primary text-primary-foreground shadow-card hover:bg-primary/90'
                : 'border border-input bg-card hover:bg-muted/60',
            )}
          >
            {ctaLabel(plan)}
          </a>
        </div>
      ))}
    </div>
  );
}
