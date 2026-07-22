import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { resolveSite } from '@/lib/services';

interface TenantLayoutProps {
  children: ReactNode;
  params: Promise<{ domain: string }>;
}

export default async function TenantLayout({ children, params }: TenantLayoutProps) {
  const { domain } = await params;
  const site = await resolveSite(domain);
  if (!site) notFound();

  // Links are root-relative to the public hostname — the middleware rewrites
  // them into the /[domain] segment internally, so no prefix here.
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-6">
          <Link href="/" className="truncate font-semibold tracking-tight">
            {site.name}
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            <Link href="/" className="rounded-md px-3 py-1.5 hover:bg-muted">
              Home
            </Link>
            <Link href="/about" className="rounded-md px-3 py-1.5 hover:bg-muted">
              About
            </Link>
            <Link href="/contact" className="rounded-md px-3 py-1.5 hover:bg-muted">
              Contact
            </Link>
            <Link
              href="/#donate"
              className="ml-2 rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground hover:opacity-90"
            >
              Donate
            </Link>
          </nav>
        </div>
      </header>

      <div className="flex-1">{children}</div>

      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        Powered by <span className="font-medium">TempleOS</span>
      </footer>
    </div>
  );
}
