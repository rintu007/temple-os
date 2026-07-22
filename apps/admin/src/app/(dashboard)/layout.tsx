import Link from 'next/link';
import type { ReactNode } from 'react';
import { Button } from '@templeos/ui';
import { signOutAction } from '@/features/auth/actions';
import { requireTenantContext } from '@/lib/session';

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, membership } = await requireTenantContext();

  return (
    <div className="min-h-dvh">
      <header className="border-b border-border">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <Link href="/" className="font-semibold tracking-tight">
                Temple<span className="text-primary">OS</span>
              </Link>
              <span className="text-muted-foreground">/</span>
              <span className="text-sm font-medium">{membership.organizationName}</span>
            </div>
            <nav className="flex items-center gap-1 text-sm">
              <Link href="/" className="rounded-md px-3 py-1.5 hover:bg-muted">
                Dashboard
              </Link>
              <Link href="/temples" className="rounded-md px-3 py-1.5 hover:bg-muted">
                Temples
              </Link>
              <Link href="/devotees" className="rounded-md px-3 py-1.5 hover:bg-muted">
                Devotees
              </Link>
              <Link href="/donations" className="rounded-md px-3 py-1.5 hover:bg-muted">
                Donations
              </Link>
              <Link href="/events" className="rounded-md px-3 py-1.5 hover:bg-muted">
                Events
              </Link>
              <Link href="/pujas" className="rounded-md px-3 py-1.5 hover:bg-muted">
                Pujas
              </Link>
              <Link href="/membership" className="rounded-md px-3 py-1.5 hover:bg-muted">
                Membership
              </Link>
              <Link href="/team" className="rounded-md px-3 py-1.5 hover:bg-muted">
                Team
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-muted-foreground sm:inline">{user.email}</span>
            <form action={signOutAction}>
              <Button variant="outline" size="sm" type="submit">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-10">{children}</main>
    </div>
  );
}
