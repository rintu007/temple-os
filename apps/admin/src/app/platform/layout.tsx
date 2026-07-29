import Link from 'next/link';
import type { ReactNode } from 'react';
import { Badge, Button } from '@templeos/ui';
import { signOutAction } from '@/features/auth/actions';
import { requirePlatformAdmin } from '@/lib/session';

export default async function PlatformLayout({ children }: { children: ReactNode }) {
  const { user } = await requirePlatformAdmin();

  return (
    <div className="min-h-dvh bg-muted/20">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link href="/platform" className="text-[15px] font-semibold tracking-tight">
              Temple<span className="text-primary">OS</span>
            </Link>
            <Badge variant="primary">Platform</Badge>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground sm:inline">{user.email}</span>
            <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
              Back to dashboard
            </Link>
            <form action={signOutAction}>
              <Button variant="outline" size="sm" type="submit">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
