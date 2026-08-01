import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { formatMoney } from '@templeos/ui';
import { getDict } from '@/i18n/dictionaries';
import { getLocale } from '@/i18n/locale';
import { getPortalSession } from '@/lib/portal-session';
import { donorPortalService, resolveSite } from '@/lib/services';

interface PortalDonationsPageProps {
  params: Promise<{ domain: string }>;
  searchParams: Promise<{ page?: string }>;
}

export const metadata: Metadata = { title: 'Donation history', robots: { index: false } };

const PAGE_SIZE = 20;

export default async function PortalDonationsPage({ params, searchParams }: PortalDonationsPageProps) {
  const { domain } = await params;
  const { page: pageParam } = await searchParams;
  const site = await resolveSite(domain);
  if (!site) notFound();

  const session = await getPortalSession(site.organizationId);
  if (!session) redirect('/portal/login');

  const locale = await getLocale();
  const t = getDict(locale);

  const page = Math.max(1, Number.parseInt(pageParam ?? '1', 10) || 1);
  const result = await donorPortalService().listDonations(session, page);
  const items = result.ok ? result.value.items : [];
  const total = result.ok ? result.value.total : 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <div className="flex items-center justify-between gap-4">
        <Link href="/portal" className="text-sm text-muted-foreground hover:text-foreground">
          {t.portal.backToDashboard}
        </Link>
        <Link href="/portal/statement" className="text-sm text-primary hover:underline">
          {t.portal.annualStatement}
        </Link>
      </div>
      <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight">
        {t.portal.donationHistoryTitle}
      </h1>

      {items.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">{t.portal.noDonations}</p>
      ) : (
        <>
          <ul className="mt-8 divide-y divide-border rounded-xl border border-border bg-card shadow-card">
            {items.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-4 p-4">
                <div className="min-w-0">
                  <div className="font-medium">{formatMoney(d.amount, d.currency)}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {d.donatedAt.toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                    {d.categoryName ? ` · ${d.categoryName}` : ''} · {d.receiptNumber}
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

          {totalPages > 1 ? (
            <div className="mt-4 flex items-center justify-center gap-4 text-sm">
              {page > 1 ? (
                <Link href={`/portal/donations?page=${page - 1}`} className="text-primary hover:underline">
                  ←
                </Link>
              ) : null}
              <span className="text-muted-foreground">
                {page} / {totalPages}
              </span>
              {page < totalPages ? (
                <Link href={`/portal/donations?page=${page + 1}`} className="text-primary hover:underline">
                  →
                </Link>
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </main>
  );
}
