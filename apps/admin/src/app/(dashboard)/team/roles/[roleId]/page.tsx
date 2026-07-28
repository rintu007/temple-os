import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { actionLabel, PERMISSION_GROUPS } from '@templeos/core';
import { Badge, Button } from '@templeos/ui';
import { deleteRoleAction, updateRoleAction } from '@/features/roles/actions';
import { RoleForm } from '@/features/roles/components/role-form';
import { requireTenantContext } from '@/lib/session';
import { roleService } from '@/lib/services';

interface RoleDetailProps {
  params: Promise<{ roleId: string }>;
}

export const metadata: Metadata = { title: 'Role' };

const groups = PERMISSION_GROUPS.map((g) => ({
  label: g.label,
  permissions: g.permissions.map((p) => ({ key: p, label: actionLabel(p) })),
}));

export default async function RoleDetailPage({ params }: RoleDetailProps) {
  const { roleId } = await params;
  const { ctx } = await requireTenantContext();
  const result = await roleService().getRole(ctx, roleId);
  if (!result.ok) notFound();
  const role = result.value;
  const granted = new Set(role.permissionKeys);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/team/roles" className="text-sm text-muted-foreground hover:text-foreground">
          ← Roles & permissions
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{role.name}</h1>
          <Badge variant={role.isSystem ? 'outline' : 'primary'}>
            {role.isSystem ? 'System' : 'Custom'}
          </Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {role.memberCount} member{role.memberCount === 1 ? '' : 's'} currently have this role.
        </p>
      </div>

      {role.isSystem ? (
        <section className="rounded-xl border border-border bg-card p-6 shadow-card">
          <p className="mb-4 text-sm text-muted-foreground">
            Built-in roles can&apos;t be edited or deleted. Create a custom role instead if you need
            a different mix of permissions.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {PERMISSION_GROUPS.map((group) => {
              const groupGranted = group.permissions.filter((p) => granted.has(p));
              if (groupGranted.length === 0) return null;
              return (
                <div key={group.label} className="rounded-lg border border-border p-3">
                  <div className="mb-1 text-sm font-medium">{group.label}</div>
                  <div className="text-xs text-muted-foreground">
                    {groupGranted.length} of {group.permissions.length} granted
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : (
        <>
          <section className="rounded-xl border border-border bg-card p-6 shadow-card">
            <RoleForm
              action={updateRoleAction.bind(null, roleId)}
              groups={groups}
              role={role}
              submitLabel="Save changes"
            />
          </section>

          <section className="rounded-xl border border-border bg-card p-6 shadow-card">
            <h2 className="text-sm font-medium text-muted-foreground">Delete role</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {role.memberCount > 0
                ? 'Reassign every member with this role before it can be deleted.'
                : 'This role has no members and can be safely removed.'}
            </p>
            {role.memberCount === 0 ? (
              <form action={deleteRoleAction.bind(null, roleId)} className="mt-4">
                <Button variant="destructive" size="sm" type="submit">
                  Delete role
                </Button>
              </form>
            ) : null}
          </section>
        </>
      )}
    </div>
  );
}
