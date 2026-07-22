import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Button } from '@templeos/ui';
import { deletePujaTypeAction, updatePujaTypeAction } from '@/features/pujas/actions';
import { PujaTypeForm } from '@/features/pujas/components/puja-type-form';
import { requireTenantContext } from '@/lib/session';
import { pujaService } from '@/lib/services';

interface PujaDetailProps {
  params: Promise<{ pujaId: string }>;
}

export const metadata: Metadata = { title: 'Puja' };

export default async function PujaDetailPage({ params }: PujaDetailProps) {
  const { pujaId } = await params;
  const { ctx, membership } = await requireTenantContext();

  const puja = await pujaService().getPujaType(ctx, pujaId);
  if (!puja.ok) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <Link href="/pujas" className="text-sm text-muted-foreground hover:text-foreground">
          ← Pujas
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{puja.value.name}</h1>
      </div>

      <section className="rounded-xl border border-border bg-card shadow-card p-6">
        <h2 className="mb-4 text-sm font-medium text-muted-foreground">Details</h2>
        <PujaTypeForm
          action={updatePujaTypeAction.bind(null, pujaId)}
          pujaType={puja.value}
          currency={membership.currency}
          submitLabel="Save changes"
        />
      </section>

      <section className="rounded-xl border border-border bg-card shadow-card p-6">
        <h2 className="text-sm font-medium text-muted-foreground">Delete</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Removes this puja from your website. Existing bookings are kept.
        </p>
        <form action={deletePujaTypeAction.bind(null, pujaId)} className="mt-4">
          <Button variant="destructive" size="sm" type="submit">
            Delete puja
          </Button>
        </form>
      </section>
    </div>
  );
}
