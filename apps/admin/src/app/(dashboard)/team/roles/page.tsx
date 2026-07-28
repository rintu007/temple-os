import type { Metadata } from 'next';
import Link from 'next/link';
import { Alert, Badge, Button } from '@templeos/ui';
import { deleteRoleAction } from '@/features/roles/actions';
import { requireTenantContext } from '@/lib/session';
import { roleService } from '@/lib/services';

export const metadata: Metadata = { title: 'Roles & permissions' };

export default async function RolesPage() {
  const { ctx } = await requireTenantContext();
  const result = await roleService().listRoles(ctx);
  if (!result.ok) return <Alert tone="error">{result.error.message}</Alert>;
  const roles = result.value;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href="/team" className="text-sm text-muted-foreground hover:text-foreground">
            ← Team
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Roles & permissions</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            The 5 built-in roles cover most temples. Add a custom role — like &quot;Treasurer&quot;
            or &quot;Priest&quot; — when you need a narrower, hand-picked set of permissions.
          </p>
        </div>
        <Link
          href="/team/roles/new"
          className="inline-flex h-9.5 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-card transition-colors hover:bg-primary/90"
        >
          New role
        </Link>
      </div>

      <ul className="divide-y divide-border rounded-xl border border-border bg-card shadow-card">
        {roles.map((r) => (
          <li key={r.id} className="flex items-center justify-between gap-4 p-4">
            <Link href={`/team/roles/${r.id}`} className="min-w-0 flex-1">
              <div className="flex items-center gap-2 font-medium">
                {r.name}
                <Badge variant={r.isSystem ? 'outline' : 'primary'}>
                  {r.isSystem ? 'System' : 'Custom'}
                </Badge>
              </div>
              <div className="mt-0.5 text-sm text-muted-foreground">
                {r.permissionCount} permission{r.permissionCount === 1 ? '' : 's'} · {r.memberCount}{' '}
                member{r.memberCount === 1 ? '' : 's'}
              </div>
            </Link>
            {!r.isSystem && r.memberCount === 0 ? (
              <form action={deleteRoleAction.bind(null, r.id)}>
                <Button variant="ghost" size="sm" type="submit">
                  Delete
                </Button>
              </form>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
