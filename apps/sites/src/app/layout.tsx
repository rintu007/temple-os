import type { Metadata } from 'next';
import Link from 'next/link';
import { Inter, Lora } from 'next/font/google';
import type { ReactNode } from 'react';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const lora = Lora({ subsets: ['latin'], variable: '--font-lora', display: 'swap' });

export const metadata: Metadata = {
  title: 'TempleOS',
  description: 'Beautiful websites and management tools for temples',
};

const signinUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/login`;
const signupUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/signup`;

/**
 * Wraps the marketing site (this app's root-level routes: `/`, `/pricing`).
 * Tenant sites live under `[domain]` and bring their own header/footer via
 * `[domain]/layout.tsx` — this one never renders for them.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${lora.variable}`}>
      <body className="flex min-h-dvh flex-col font-sans antialiased">
        <header className="sticky top-0 z-10 border-b border-border/80 bg-background/90 backdrop-blur-md">
          <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-6">
            <Link
              href="/"
              className="font-[family-name:var(--font-display)] text-lg font-semibold tracking-tight"
            >
              TempleOS
            </Link>
            <nav className="flex items-center gap-1 text-sm">
              <Link
                href="/pricing"
                className="rounded-lg px-3 py-1.5 font-medium text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
              >
                Pricing
              </Link>
              <a
                href={signinUrl}
                className="rounded-lg px-3 py-1.5 font-medium text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
              >
                Sign in
              </a>
              <a
                href={signupUrl}
                className="ml-1 rounded-full bg-primary px-4 py-1.5 font-medium text-primary-foreground shadow-card transition-colors hover:bg-primary/90"
              >
                Start free trial
              </a>
            </nav>
          </div>
        </header>

        <div className="flex-1">{children}</div>

        <footer className="border-t border-border bg-muted/30">
          <div className="mx-auto flex max-w-5xl flex-col items-center gap-3 px-6 py-10 text-center">
            <div className="font-[family-name:var(--font-display)] text-base font-semibold">
              TempleOS
            </div>
            <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
              <Link href="/pricing" className="hover:text-foreground">
                Pricing
              </Link>
              <a href={signinUrl} className="hover:text-foreground">
                Sign in
              </a>
              <a href={signupUrl} className="hover:text-foreground">
                Start free trial
              </a>
            </nav>
            <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
              <Link href="/terms" className="hover:text-foreground">
                Terms of Service
              </Link>
              <Link href="/privacy" className="hover:text-foreground">
                Privacy Policy
              </Link>
              <Link href="/refund-policy" className="hover:text-foreground">
                Refund Policy
              </Link>
              <Link href="/status" className="hover:text-foreground">
                System Status
              </Link>
            </nav>
            <div className="text-xs text-muted-foreground">
              &copy; {new Date().getFullYear()} TempleOS
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
