import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { formatMoney } from '@templeos/ui';
import { portalLogoutAction } from '@/features/donor-portal/actions';
import { getDict } from '@/i18n/dictionaries';
import { getLocale } from '@/i18n/locale';
import { PORTAL_COOKIE, getPortalSession } from '@/lib/portal-session';
import { donorPortalService, resolveSite } from '@/lib/services';

interface PortalPageProps {
  params: Promise<{ domain: string }>;
}

export const metadata: Metadata = { title: 'My donations', robots: { index: false } };

export default async function PortalPage({ params }: PortalPageProps) {
  const { domain } = await params;
  const site = await resolveSite(domain);
  if (!site) notFound();

  const session = await getPortalSession(site.organizationId);
  if (!session) redirect('/portal/login');

  const locale = await getLocale();
  const t = getDict(locale);

  const result = await donorPortalService().getGivingSummary(session);
  const summary = result.ok
    ? result.value
    : { currency: 'INR' as const, lifetimeTotal: '0.00', lifetimeCount: 0, fyTotal: '0.00', fyCount: 0, fyLabel: '', recent: [] };

  const sessionToken = (await cookies()).get(PORTAL_COOKIE)?.value ?? '';

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-sm font-medium uppercase tracking-widest text-primary">
            {t.portal.eyebrow}
          </div>
          <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight">
            {t.portal.welcomeBack(session.devoteeName)}
          </h1>
        </div>
        <form action={portalLogoutAction.bind(null, site.organizationId, sessionToken)}>
          <button type="submit" className="text-sm text-muted-foreground hover:text-foreground">
            {t.portal.logout}
          </button>
        </form>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5 shadow-card">
          <div className="text-sm text-muted-foreground">{t.portal.lifetimeGiving}</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">
            {formatMoney(summary.lifetimeTotal, summary.currency)}
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {summary.lifetimeCount} donation{summary.lifetimeCount === 1 ? '' : 's'}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 shadow-card">
          <div className="text-sm text-muted-foreground">
            {t.portal.thisYear} {summary.fyLabel ? `(${summary.fyLabel})` : ''}
          </div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">
            {formatMoney(summary.fyTotal, summary.currency)}
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {summary.fyCount} donation{summary.fyCount === 1 ? '' : 's'}
          </div>
        </div>
      </div>

      <div className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">{t.portal.recentDonations}</h2>
          <Link href="/portal/donations" className="text-sm text-primary hover:underline">
            {t.portal.viewAllDonations}
          </Link>
        </div>

        {summary.recent.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">{t.portal.noDonations}</p>
        ) : (
          <ul className="mt-4 divide-y divide-border rounded-xl border border-border bg-card shadow-card">
            {summary.recent.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-4 p-4">
                <div className="min-w-0">
                  <div className="font-medium">{formatMoney(d.amount, d.currency)}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {d.donatedAt.toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                    {d.categoryName ? ` · ${d.categoryName}` : ''}
                  </div>
                </div>
                <Link
                  href={`/portal/donations/${d.id}/receipt`}
                  className="shrink-0 text-sm text-primary hover:underline"
                >
                  {t.portal.viewReceipt}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
