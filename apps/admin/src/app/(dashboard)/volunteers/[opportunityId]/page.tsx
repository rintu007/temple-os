import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Alert, Badge, Button } from '@templeos/ui';
import { setOpportunityStatusAction } from '@/features/volunteers/actions';
import { requireTenantContext } from '@/lib/session';
import { volunteerService } from '@/lib/services';

interface OpportunityDetailProps {
  params: Promise<{ opportunityId: string }>;
}

export const metadata: Metadata = { title: 'Opportunity' };

export default async function OpportunityDetailPage({ params }: OpportunityDetailProps) {
  const { opportunityId } = await params;
  const { ctx } = await requireTenantContext();

  const result = await volunteerService().getOpportunity(ctx, opportunityId);
  if (!result.ok) notFound();
  const { opportunity: o, signups } = result.value;

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <Link href="/volunteers" className="text-sm text-muted-foreground hover:text-foreground">
          ← Volunteers
        </Link>
        <div className="mt-2 flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{o.title}</h1>
          {o.status === 'open' ? (
            <Badge variant="success">Open</Badge>
          ) : (
            <Badge variant="outline">Closed</Badge>
          )}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {o.servingOn
            ? `${new Date(`${o.servingOn}T12:00:00`).toLocaleDateString('en-IN', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })} · `
            : ''}
          {o.signupCount} signed up{o.slotsNeeded > 0 ? ` of ${o.slotsNeeded} needed` : ''}
        </p>
        {o.description ? (
          <p className="mt-3 text-sm whitespace-pre-line text-muted-foreground">{o.description}</p>
        ) : null}
      </div>

      <div className="flex gap-2">
        {o.status === 'open' ? (
          <form action={setOpportunityStatusAction.bind(null, o.id, 'closed')}>
            <Button variant="outline" size="sm" type="submit">
              Close sign-ups
            </Button>
          </form>
        ) : (
          <form action={setOpportunityStatusAction.bind(null, o.id, 'open')}>
            <Button size="sm" type="submit">
              Reopen
            </Button>
          </form>
        )}
      </div>

      <section>
        <h2 className="text-sm font-medium text-muted-foreground">Sign-ups ({signups.length})</h2>
        {signups.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No one has signed up yet.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-border rounded-xl border border-border bg-card shadow-card">
            {signups.map((s) => (
              <li key={s.id} className="p-4">
                <div className="font-medium">{s.name}</div>
                <div className="mt-0.5 text-sm text-muted-foreground">
                  {[s.phone, s.email].filter(Boolean).join(' · ') || 'No contact details'}
                </div>
                {s.note ? <p className="mt-1 text-sm text-muted-foreground">{s.note}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {o.status === 'open' ? (
        <Alert tone="info">This opportunity is live on your public site for devotees to join.</Alert>
      ) : null}
    </div>
  );
}
