import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { LoginForm } from '@/features/donor-portal/components/login-form';
import { getDict } from '@/i18n/dictionaries';
import { getLocale } from '@/i18n/locale';
import { getPortalSession } from '@/lib/portal-session';
import { resolveSite } from '@/lib/services';

interface PortalLoginPageProps {
  params: Promise<{ domain: string }>;
}

export async function generateMetadata({ params }: PortalLoginPageProps): Promise<Metadata> {
  const { domain } = await params;
  const site = await resolveSite(domain);
  if (!site) return { title: 'Site not found' };
  return { title: `Donor portal · ${site.name}`, robots: { index: false } };
}

export default async function PortalLoginPage({ params }: PortalLoginPageProps) {
  const { domain } = await params;
  const site = await resolveSite(domain);
  if (!site) notFound();

  const existing = await getPortalSession(site.organizationId);
  if (existing) redirect('/portal');

  const locale = await getLocale();
  const t = getDict(locale);

  return (
    <main className="mx-auto max-w-md px-6 py-24">
      <div className="text-center">
        <div className="text-sm font-medium uppercase tracking-widest text-primary">
          {t.portal.eyebrow}
        </div>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight">
          {t.portal.loginTitle}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">{t.portal.loginIntro}</p>
      </div>

      <div className="mt-8">
        <LoginForm
          organizationId={site.organizationId}
          organizationName={site.name}
          emailLabel={t.portal.emailLabel}
          submitLabel={t.portal.sendLink}
          sendingLabel={t.portal.sending}
        />
      </div>
    </main>
  );
}
