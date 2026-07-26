import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge, formatMoney } from '@templeos/ui';
import { updateInKindAction } from '@/features/in-kind/actions';
import { DispositionForm } from '@/features/in-kind/components/disposition-form';
import { InKindForm } from '@/features/in-kind/components/in-kind-form';
import { requireTenantContext } from '@/lib/session';
import { devoteeService, inKindService } from '@/lib/services';

interface InKindDetailProps {
  params: Promise<{ inKindId: string }>;
}

export const metadata: Metadata = { title: 'Offering' };

const CATEGORY_LABELS: Record<string, string> = {
  gold: 'Gold',
  silver: 'Silver',
  jewellery: 'Jewellery',
  grain: 'Grain',
  cloth: 'Cloth',
  other: 'Other',
};

const DISPOSITION_LABELS: Record<string, string> = {
  in_stock: 'In stock',
  sold: 'Sold',
  used: 'Used',
  returned: 'Returned',
};

export default async function InKindDetailPage({ params }: InKindDetailProps) {
  const { inKindId } = await params;
  const { ctx, membership } = await requireTenantContext();

  const [result, devotees] = await Promise.all([
    inKindService().getInKind(ctx, inKindId),
    devoteeService().listDevotees(ctx, { pageSize: 100 }),
  ]);
  if (!result.ok) notFound();
  const o = result.value;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/in-kind" className="text-sm text-muted-foreground hover:text-foreground">
          ← In-kind offerings
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
              {o.item}
              <Badge variant="outline">{CATEGORY_LABELS[o.category] ?? o.category}</Badge>
              <Badge variant="outline">
                {DISPOSITION_LABELS[o.disposition] ?? o.disposition}
              </Badge>
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {o.donorName}
              {o.quantity ? ` · ${o.quantity}${o.unit ? ` ${o.unit}` : ''}` : ''} · received{' '}
              {o.receivedOn}
            </p>
          </div>
          {o.estimatedValue ? (
            <div className="text-right">
              <div className="text-2xl font-semibold tabular-nums">
                {formatMoney(o.estimatedValue, o.currency)}
              </div>
              <div className="text-xs text-muted-foreground">estimated value</div>
            </div>
          ) : null}
        </div>
      </div>

      <section className="rounded-xl border border-border bg-card p-6 shadow-card">
        <h2 className="mb-4 text-sm font-medium text-muted-foreground">Disposition</h2>
        <DispositionForm offering={o} />
      </section>

      <section className="rounded-xl border border-border bg-card p-6 shadow-card">
        <h2 className="mb-4 text-sm font-medium text-muted-foreground">Offering details</h2>
        <InKindForm
          action={updateInKindAction.bind(null, inKindId)}
          offering={o}
          devotees={devotees.ok ? devotees.value.items : []}
          currency={membership.currency}
          submitLabel="Save changes"
        />
      </section>
    </div>
  );
}
