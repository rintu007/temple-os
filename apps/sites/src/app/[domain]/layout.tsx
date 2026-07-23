import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { LanguageSwitcher } from '@/components/language-switcher';
import { getDict } from '@/i18n/dictionaries';
import { getLocale } from '@/i18n/locale';
import { resolveSite } from '@/lib/services';

interface TenantLayoutProps {
  children: ReactNode;
  params: Promise<{ domain: string }>;
}

export default async function TenantLayout({ children, params }: TenantLayoutProps) {
  const { domain } = await params;
  const site = await resolveSite(domain);
  if (!site) notFound();

  const locale = await getLocale();
  const t = getDict(locale);

  const navLinks = [
    { href: '/', label: t.nav.home },
    { href: '/about', label: t.nav.about },
    { href: '/gallery', label: t.nav.gallery },
    { href: '/volunteer', label: t.nav.volunteer },
    { href: '/facilities', label: t.nav.facilities },
    { href: '/contact', label: t.nav.contact },
  ];

  // Links are root-relative to the public hostname — the middleware rewrites
  // them into the /[domain] segment internally, so no prefix here.
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-10 border-b border-border/80 bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between gap-4 px-6">
          <Link
            href="/"
            className="min-w-0 truncate font-[family-name:var(--font-display)] text-lg font-semibold tracking-tight"
          >
            {site.name}
          </Link>
          <nav className="flex shrink-0 items-center gap-0.5 text-sm">
            {navLinks.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="hidden rounded-lg px-3 py-1.5 font-medium text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground sm:inline-block"
              >
                {label}
              </Link>
            ))}
            <Link
              href="/#donate"
              className="ml-2 rounded-full bg-primary px-4 py-1.5 font-medium text-primary-foreground shadow-card transition-colors hover:bg-primary/90"
            >
              {t.nav.donate}
            </Link>
            <div className="ml-2">
              <LanguageSwitcher current={locale} />
            </div>
          </nav>
        </div>
        {/* Mobile nav */}
        <nav className="flex items-center gap-1 overflow-x-auto border-t border-border/60 px-4 py-1.5 text-sm sm:hidden">
          {navLinks.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="rounded-lg px-3 py-1 font-medium whitespace-nowrap text-muted-foreground hover:bg-muted/70 hover:text-foreground"
            >
              {label}
            </Link>
          ))}
        </nav>
      </header>

      <div className="flex-1">{children}</div>

      <footer className="border-t border-border bg-muted/30">
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-4 px-6 py-10 text-center">
          <div className="font-[family-name:var(--font-display)] text-base font-semibold">
            {site.name}
          </div>
          <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
            {navLinks.map(({ href, label }) => (
              <Link key={href} href={href} className="hover:text-foreground">
                {label}
              </Link>
            ))}
            <Link href="/#donate" className="hover:text-foreground">
              {t.nav.donate}
            </Link>
          </nav>
          <div className="text-xs text-muted-foreground">
            {t.footer.poweredBy} <span className="font-semibold text-foreground">TempleOS</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
