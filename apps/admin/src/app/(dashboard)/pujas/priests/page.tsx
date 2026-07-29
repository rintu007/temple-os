import type { Metadata } from 'next';
import Link from 'next/link';
import { Alert, Badge, Button, formatTime } from '@templeos/ui';
import {
  removeDutyAssignmentAction,
  deleteLeaveAction,
  togglePriestAction,
} from '@/features/pujas/actions';
import { DutyRosterForm } from '@/features/pujas/components/duty-roster-form';
import { LeaveForm } from '@/features/pujas/components/leave-form';
import { PriestForm } from '@/features/pujas/components/priest-form';
import { requireTenantContext } from '@/lib/session';
import { pujaService, templeService } from '@/lib/services';

export const metadata: Metadata = { title: 'Priests' };

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default async function PriestsPage() {
  const { ctx } = await requireTenantContext('worship');
  const [priestsResult, rosterResult, todaysResult, leavesResult, templesResult] =
    await Promise.all([
      pujaService().listPriests(ctx),
      pujaService().listDutyRoster(ctx),
      pujaService().todaysDuty(ctx),
      pujaService().listLeaves(ctx),
      templeService().listTemples(ctx),
    ]);

  if (!priestsResult.ok) return <Alert tone="error">{priestsResult.error.message}</Alert>;
  const priests = priestsResult.value;
  const roster = rosterResult.ok ? rosterResult.value : [];
  const todaysDuty = todaysResult.ok ? todaysResult.value : [];
  const leaves = leavesResult.ok ? leavesResult.value : [];
  const temples = templesResult.ok ? templesResult.value : [];

  const scheduleLists = await Promise.all(
    temples.map((t) => templeService().listSchedule(ctx, t.id)),
  );
  const schedules = temples.flatMap((t, i) => {
    const items = scheduleLists[i];
    if (!items?.ok) return [];
    return items.value.map((s) => ({
      id: s.id,
      label: temples.length > 1 ? `${t.name} — ${s.title} (${formatTime(s.startTime)})` : `${s.title} (${formatTime(s.startTime)})`,
    }));
  });

  const activePriests = priests.filter((p) => p.isActive).map((p) => ({ id: p.id, name: p.name }));

  return (
    <div className="space-y-6">
      <div>
        <Link href="/pujas" className="text-sm text-muted-foreground hover:text-foreground">
          ← Pujas
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Priests</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your pujari roster, their standing duty schedule, and time off — assign priests to
          one-off booked sevas from the bookings queue instead.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card shadow-card p-6">
        <PriestForm />
      </div>

      {priests.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <h2 className="font-medium">No priests yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Add your pujaris above to start scheduling sevas.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card shadow-card">
          {priests.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-4 p-4">
              <div>
                <div className="flex items-center gap-2 font-medium">
                  {p.name}
                  {!p.isActive ? <Badge variant="outline">Inactive</Badge> : null}
                </div>
                <div className="mt-0.5 text-sm text-muted-foreground">
                  {[p.phone, p.specialty].filter(Boolean).join(' · ') || 'No details'}
                </div>
              </div>
              <form action={togglePriestAction.bind(null, p.id, !p.isActive)}>
                <Button variant="ghost" size="sm" type="submit">
                  {p.isActive ? 'Deactivate' : 'Reactivate'}
                </Button>
              </form>
            </li>
          ))}
        </ul>
      )}

      <div>
        <h2 className="text-lg font-semibold tracking-tight">Today&apos;s duty</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Who&apos;s on for each ritual today — flagged if they&apos;re on leave and need a
          substitute.
        </p>
        {todaysDuty.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No standing duty assigned yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border rounded-xl border border-border bg-card shadow-card">
            {todaysDuty.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <div className="font-medium">
                    {d.scheduleTitle}{' '}
                    <span className="font-normal text-muted-foreground">
                      {formatTime(d.startTime)}
                      {d.endTime ? `–${formatTime(d.endTime)}` : ''}
                    </span>
                  </div>
                  <div className="mt-0.5 text-sm text-muted-foreground">
                    {d.priestName}
                    {d.templeName ? ` · ${d.templeName}` : ''}
                  </div>
                </div>
                {d.onLeave ? <Badge variant="destructive">On leave — needs cover</Badge> : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h2 className="text-lg font-semibold tracking-tight">Weekly duty roster</h2>
        <div className="mt-3 rounded-xl border border-border bg-card shadow-card p-6">
          <DutyRosterForm priests={activePriests} schedules={schedules} />
        </div>
        {roster.length > 0 ? (
          <ul className="mt-3 divide-y divide-border rounded-xl border border-border bg-card shadow-card">
            {roster.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <div className="font-medium">
                    {r.priestName} — {r.scheduleTitle}
                  </div>
                  <div className="mt-0.5 text-sm text-muted-foreground">
                    {r.daysOfWeek.length === 0
                      ? 'Every day'
                      : r.daysOfWeek
                          .slice()
                          .sort()
                          .map((d) => DAY_LABELS[d])
                          .join(', ')}
                    {r.notes ? ` · ${r.notes}` : ''}
                  </div>
                </div>
                <form action={removeDutyAssignmentAction.bind(null, r.id)}>
                  <Button variant="ghost" size="sm" type="submit">
                    Remove
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div>
        <h2 className="text-lg font-semibold tracking-tight">Time off</h2>
        <div className="mt-3 rounded-xl border border-border bg-card shadow-card p-6">
          <LeaveForm priests={activePriests} />
        </div>
        {leaves.length > 0 ? (
          <ul className="mt-3 divide-y divide-border rounded-xl border border-border bg-card shadow-card">
            {leaves.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <div className="font-medium">{l.priestName}</div>
                  <div className="mt-0.5 text-sm text-muted-foreground">
                    {l.startDate} – {l.endDate}
                    {l.reason ? ` · ${l.reason}` : ''}
                  </div>
                </div>
                <form action={deleteLeaveAction.bind(null, l.id)}>
                  <Button variant="ghost" size="sm" type="submit">
                    Remove
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
