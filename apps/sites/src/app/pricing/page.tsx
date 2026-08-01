import type { Metadata } from 'next';
import { Section } from '@/components/section';
import { PricingGrid } from '@/components/pricing-grid';
import { planService } from '@/lib/services';

export const metadata: Metadata = {
  title: 'Pricing — TempleOS',
  description:
    'TempleOS pricing: a free public website and core temple operations forever, with paid tiers for worship bookings, community tools, fundraising, and full fund accounting.',
};

const signupUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/signup`;

/** Revalidate periodically so plan/price edits made in /platform/plans show up without a redeploy. */
export const revalidate = 300;

export default async function PricingPage() {
  const plans = await planService().listPlans();

  return (
    <main>
      <div className="mx-auto max-w-3xl px-6 pt-20 pb-4 text-center sm:pt-28">
        <div className="text-xs font-semibold tracking-[0.25em] text-primary uppercase">Pricing</div>
        <h1 className="mt-3 font-[family-name:var(--font-display)] text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          Simple, transparent pricing
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-base text-muted-foreground">
          Every temple starts with a 14-day trial and no card required. Core operations — your
          public website, devotees, donations, and events — stay free forever, even on Starter.
        </p>
      </div>

      <Section>
        <PricingGrid plans={plans} signupUrl={signupUrl} />
      </Section>

      <Section eyebrow="Questions" title="Good to know" tone="muted">
        <dl className="mx-auto grid max-w-3xl gap-6 sm:grid-cols-2">
          <div>
            <dt className="font-medium">What happens when the trial ends?</dt>
            <dd className="mt-1 text-sm text-muted-foreground">
              Your temple drops to the free Starter plan — your website, devotees, donations, and
              events keep working. Upgrade any time to bring back worship, community, and
              fundraising tools.
            </dd>
          </div>
          <div>
            <dt className="font-medium">Is my devotees&apos; donation intake ever affected?</dt>
            <dd className="mt-1 text-sm text-muted-foreground">
              Never. Your public site and its ability to receive donations always keep working,
              regardless of your TempleOS subscription status.
            </dd>
          </div>
          <div>
            <dt className="font-medium">Can I change plans later?</dt>
            <dd className="mt-1 text-sm text-muted-foreground">
              Yes — upgrade, downgrade, or cancel any time from your billing page. Changes take
              effect immediately.
            </dd>
          </div>
          <div>
            <dt className="font-medium">Do you offer discounts for smaller temples?</dt>
            <dd className="mt-1 text-sm text-muted-foreground">
              Reach out after signing up and we&apos;re happy to talk — every temple is different.
            </dd>
          </div>
        </dl>
      </Section>
    </main>
  );
}
