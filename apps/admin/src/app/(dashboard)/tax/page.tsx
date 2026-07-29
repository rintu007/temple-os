import type { Metadata } from 'next';
import { Alert } from '@templeos/ui';
import { TaxProfileForm } from '@/features/tax/components/tax-profile-form';
import { requireTenantContext } from '@/lib/session';
import { taxService } from '@/lib/services';

export const metadata: Metadata = { title: '80G & tax' };

export default async function TaxPage() {
  const { ctx } = await requireTenantContext('accounting');
  const result = await taxService().getProfile(ctx);
  if (!result.ok) {
    return <Alert tone="error">{result.error.message}</Alert>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">80G &amp; tax</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your trust&apos;s registration details. These print on donation receipts so donors can
          claim their income-tax deduction under section 80G.
        </p>
      </div>

      <div className="max-w-2xl rounded-xl border border-border bg-card p-6 shadow-card">
        <TaxProfileForm profile={result.value} />
      </div>

      <p className="max-w-2xl text-xs text-muted-foreground">
        Every donation gets a printable 80G receipt from its detail page. Capture the donor&apos;s
        PAN when recording a donation to include it on the receipt.
      </p>
    </div>
  );
}
