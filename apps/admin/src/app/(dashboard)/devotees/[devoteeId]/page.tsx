import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Button } from '@templeos/ui';
import { archiveDevoteeAction, updateDevoteeAction } from '@/features/devotees/actions';
import { DevoteeForm } from '@/features/devotees/components/devotee-form';
import { requireTenantContext } from '@/lib/session';
import { devoteeService } from '@/lib/services';

interface DevoteeDetailProps {
  params: Promise<{ devoteeId: string }>;
}

export const metadata: Metadata = { title: 'Devotee' };

export default async function DevoteeDetailPage({ params }: DevoteeDetailProps) {
  const { devoteeId } = await params;
  const { ctx } = await requireTenantContext();

  const devotee = await devoteeService().getDevotee(ctx, devoteeId);
  if (!devotee.ok) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <Link href="/devotees" className="text-sm text-muted-foreground hover:text-foreground">
          ← Devotees
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{devotee.value.fullName}</h1>
      </div>

      <section className="rounded-xl border border-border bg-card shadow-card p-6">
        <h2 className="mb-4 text-sm font-medium text-muted-foreground">Profile</h2>
        <DevoteeForm
          action={updateDevoteeAction.bind(null, devoteeId)}
          devotee={devotee.value}
          submitLabel="Save changes"
        />
      </section>

      <section className="rounded-xl border border-border bg-card shadow-card p-6">
        <h2 className="text-sm font-medium text-muted-foreground">Archive</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Removes this devotee from the active directory. Their history is kept and they can be
          restored later.
        </p>
        <form action={archiveDevoteeAction.bind(null, devoteeId)} className="mt-4">
          <Button variant="destructive" size="sm" type="submit">
            Archive devotee
          </Button>
        </form>
      </section>
    </div>
  );
}
