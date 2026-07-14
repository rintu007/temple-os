import type { Metadata } from 'next';

interface TenantPageProps {
  params: Promise<{ domain: string }>;
}

export async function generateMetadata({ params }: TenantPageProps): Promise<Metadata> {
  const { domain } = await params;
  return {
    title: decodeURIComponent(domain),
    // Tenant sites stay out of search indexes until the org publishes its site
    robots: { index: false },
  };
}

/**
 * Placeholder tenant homepage. Phase 0 proves host→tenant routing; the
 * theme-driven CMS renderer replaces this in Phase 1 (published pages +
 * ISR with tag revalidation per organization).
 */
export default async function TenantHomePage({ params }: TenantPageProps) {
  const { domain } = await params;
  const tenant = decodeURIComponent(domain);

  return (
    <main className="flex min-h-dvh items-center justify-center p-8">
      <div className="w-full max-w-lg rounded-xl border border-border p-10 text-center shadow-sm">
        <div className="mb-3 text-sm font-medium uppercase tracking-widest text-primary">
          TempleOS
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">{tenant}</h1>
        <p className="mt-3 text-muted-foreground">
          This temple&apos;s website is being prepared. Tenant resolved from the hostname —
          multi-tenant routing is working.
        </p>
      </div>
    </main>
  );
}
