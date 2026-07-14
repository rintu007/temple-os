import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { hostnameFromDomainParam, organizationService } from '@/lib/services';

interface TenantPageProps {
  params: Promise<{ domain: string }>;
}

export async function generateMetadata({ params }: TenantPageProps): Promise<Metadata> {
  const { domain } = await params;
  const site = await organizationService().resolveSiteByHostname(hostnameFromDomainParam(domain));
  if (!site) return { title: 'Site not found' };
  return {
    title: site.name,
    description: `${site.name} — daily schedule, events, donations and more.`,
    // Tenant sites stay out of search indexes until publishing lands (Phase 1)
    robots: { index: false },
  };
}

/**
 * Tenant homepage, resolved live from the database (host → domains → org).
 * The theme-driven CMS renderer with ISR replaces this placeholder in Phase 1.
 */
export default async function TenantHomePage({ params }: TenantPageProps) {
  const { domain } = await params;
  const site = await organizationService().resolveSiteByHostname(hostnameFromDomainParam(domain));
  if (!site) notFound();

  return (
    <main className="flex min-h-dvh items-center justify-center p-8">
      <div className="w-full max-w-lg rounded-xl border border-border p-10 text-center shadow-sm">
        <div className="mb-3 text-sm font-medium uppercase tracking-widest text-primary">
          Welcome to
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">{site.name}</h1>
        <p className="mt-3 text-muted-foreground">
          Our website is being prepared. Soon you&apos;ll find our daily schedule, events,
          festivals and online donations here.
        </p>
        <p className="mt-8 text-xs text-muted-foreground">
          Powered by <span className="font-medium">TempleOS</span>
        </p>
      </div>
    </main>
  );
}
