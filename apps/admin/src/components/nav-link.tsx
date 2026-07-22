'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { cn } from '@templeos/ui';

export interface NavLinkProps {
  href: string;
  children: ReactNode;
  className?: string;
}

/** Sidebar link with active-route highlighting ('/' matches exactly). */
export function NavLink({ href, children, className }: NavLinkProps) {
  const pathname = usePathname();
  const active = href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors [&>svg]:size-4 [&>svg]:shrink-0',
        active
          ? 'bg-accent text-accent-foreground'
          : 'text-sidebar-foreground hover:bg-muted/70 hover:text-foreground',
        className,
      )}
    >
      {children}
    </Link>
  );
}
