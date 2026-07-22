import {
  BarChart3,
  CalendarDays,
  Flame,
  Globe,
  HandCoins,
  IdCard,
  Landmark,
  LayoutDashboard,
  UserRound,
  UserRoundCog,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Badge, Button } from '@templeos/ui';
import { NavLink } from '@/components/nav-link';
import { signOutAction } from '@/features/auth/actions';
import { requireTenantContext } from '@/lib/session';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

interface NavGroup {
  label: string | null;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: null,
    items: [{ href: '/', label: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    label: 'Worship',
    items: [
      { href: '/temples', label: 'Temples', icon: Landmark },
      { href: '/pujas', label: 'Pujas', icon: Flame },
      { href: '/events', label: 'Events', icon: CalendarDays },
    ],
  },
  {
    label: 'Community',
    items: [
      { href: '/devotees', label: 'Devotees', icon: Users },
      { href: '/membership', label: 'Membership', icon: IdCard },
      { href: '/team', label: 'Team', icon: UserRoundCog },
    ],
  },
  {
    label: 'Finance',
    items: [
      { href: '/donations', label: 'Donations', icon: HandCoins },
      { href: '/reports', label: 'Reports', icon: BarChart3 },
    ],
  },
  {
    label: 'Online presence',
    items: [{ href: '/website', label: 'Website', icon: Globe }],
  },
];

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, membership } = await requireTenantContext();

  const nav = (
    <nav className="flex flex-col gap-5">
      {NAV_GROUPS.map((group) => (
        <div key={group.label ?? 'root'}>
          {group.label ? (
            <div className="mb-1.5 px-2.5 text-[11px] font-semibold tracking-wider text-muted-foreground/80 uppercase">
              {group.label}
            </div>
          ) : null}
          <div className="flex flex-col gap-0.5">
            {group.items.map(({ href, label, icon: Icon }) => (
              <NavLink key={href} href={href}>
                <Icon aria-hidden />
                {label}
              </NavLink>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="flex min-h-dvh">
      {/* Sidebar — desktop */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
        <div className="flex h-14 items-center border-b border-sidebar-border px-5">
          <Link href="/" className="text-[15px] font-semibold tracking-tight">
            Temple<span className="text-primary">OS</span>
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-4">{nav}</div>
        <div className="border-t border-sidebar-border p-3">
          <div className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
              <UserRound className="size-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{user.email}</div>
              <div className="text-xs text-muted-foreground capitalize">{membership.roleName}</div>
            </div>
          </div>
          <form action={signOutAction} className="mt-2">
            <Button variant="outline" size="sm" type="submit" className="w-full">
              Sign out
            </Button>
          </form>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar */}
        <header className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur">
          <div className="flex h-14 items-center justify-between gap-4 px-4 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <Link href="/" className="font-semibold tracking-tight lg:hidden">
                Temple<span className="text-primary">OS</span>
              </Link>
              <span className="hidden text-border lg:inline">·</span>
              <span className="truncate text-sm font-medium">{membership.organizationName}</span>
              <Badge variant="primary" className="hidden capitalize sm:inline-flex">
                {membership.roleName}
              </Badge>
            </div>
            <div className="flex shrink-0 items-center gap-2 lg:hidden">
              <form action={signOutAction}>
                <Button variant="ghost" size="sm" type="submit">
                  Sign out
                </Button>
              </form>
            </div>
          </div>
          {/* Mobile nav — horizontal scroll */}
          <div className="overflow-x-auto border-t border-border px-2 py-1.5 lg:hidden">
            <div className="flex w-max items-center gap-1">
              {NAV_GROUPS.flatMap((g) => g.items).map(({ href, label, icon: Icon }) => (
                <NavLink key={href} href={href} className="whitespace-nowrap">
                  <Icon aria-hidden />
                  {label}
                </NavLink>
              ))}
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
