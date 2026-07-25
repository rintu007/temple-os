import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Button } from '@templeos/ui';
import { setOfficerActiveAction, updateOfficerAction } from '@/features/officers/actions';
import { OfficerForm } from '@/features/officers/components/officer-form';
import { requireTenantContext } from '@/lib/session';
import { officerService } from '@/lib/services';

interface OfficerDetailProps {
  params: Promise<{ officerId: string }>;
}

export const metadata: Metadata = { title: 'Office bearer' };

export default async function OfficerDetailPage({ params }: OfficerDetailProps) {
  const { officerId } = await params;
  const { ctx } = await requireTenantContext();

  const result = await officerService().getOfficer(ctx, officerId);
  if (!result.ok) notFound();
  const officer = result.value;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/officers" className="text-sm text-muted-foreground hover:text-foreground">
          ← Office bearers
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{officer.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {officer.designation}
          {officer.isActive ? '' : ' · former'}
        </p>
      </div>

      <section className="rounded-xl border border-border bg-card p-6 shadow-card">
        <h2 className="mb-4 text-sm font-medium text-muted-foreground">Details</h2>
        <OfficerForm
          action={updateOfficerAction.bind(null, officerId)}
          officer={officer}
          submitLabel="Save changes"
        />
      </section>

      <section className="rounded-xl border border-border bg-card p-6 shadow-card">
        <h2 className="text-sm font-medium text-muted-foreground">
          {officer.isActive ? 'End term' : 'Reinstate'}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {officer.isActive
            ? 'Move this person to the former list. Their record is kept, with an end date.'
            : 'Return this person to the active office-bearers list.'}
        </p>
        <form
          action={setOfficerActiveAction.bind(null, officerId, !officer.isActive)}
          className="mt-4"
        >
          <Button variant={officer.isActive ? 'destructive' : 'outline'} size="sm" type="submit">
            {officer.isActive ? 'End term' : 'Reinstate'}
          </Button>
        </form>
      </section>
    </div>
  );
}
