import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Button, formatTime } from '@templeos/ui';
import {
  addScheduleItemAction,
  removeScheduleItemAction,
  updateTempleAction,
} from '@/features/temples/actions';
import { AddScheduleForm } from '@/features/temples/components/add-schedule-form';
import { TempleForm } from '@/features/temples/components/temple-form';
import { requireTenantContext } from '@/lib/session';
import { templeService } from '@/lib/services';

interface TempleDetailProps {
  params: Promise<{ templeId: string }>;
}

export const metadata: Metadata = { title: 'Temple' };

export default async function TempleDetailPage({ params }: TempleDetailProps) {
  const { templeId } = await params;
  const { ctx } = await requireTenantContext();

  const temple = await templeService().getTemple(ctx, templeId);
  if (!temple.ok) notFound();
  const schedule = await templeService().listSchedule(ctx, templeId);
  const items = schedule.ok ? schedule.value : [];

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <Link href="/temples" className="text-sm text-muted-foreground hover:text-foreground">
          ← Temples
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{temple.value.name}</h1>
      </div>

      <section className="rounded-xl border border-border bg-card shadow-card p-6">
        <h2 className="mb-4 text-sm font-medium text-muted-foreground">Profile</h2>
        <TempleForm
          action={updateTempleAction.bind(null, templeId)}
          temple={temple.value}
          submitLabel="Save changes"
        />
      </section>

      <section className="rounded-xl border border-border bg-card shadow-card p-6">
        <h2 className="text-sm font-medium text-muted-foreground">Daily schedule</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Shown on your public website. Times are local to the temple.
        </p>

        {items.length > 0 ? (
          <ul className="mt-4 divide-y divide-border rounded-md border border-border">
            {items.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-4 px-4 py-3">
                <div>
                  <div className="text-sm font-medium">{item.title}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {formatTime(item.startTime)}
                    {item.endTime ? ` – ${formatTime(item.endTime)}` : ''}
                    {item.description ? ` · ${item.description}` : ''}
                  </div>
                </div>
                <form action={removeScheduleItemAction.bind(null, templeId, item.id)}>
                  <Button variant="ghost" size="sm" type="submit">
                    Remove
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">No schedule entries yet.</p>
        )}

        <div className="mt-6 border-t border-border pt-6">
          <AddScheduleForm action={addScheduleItemAction.bind(null, templeId)} />
        </div>
      </section>
    </div>
  );
}
