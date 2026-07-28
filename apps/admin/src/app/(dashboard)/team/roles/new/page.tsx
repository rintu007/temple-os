import type { Metadata } from 'next';
import Link from 'next/link';
import { actionLabel, PERMISSION_GROUPS } from '@templeos/core';
import { createRoleAction } from '@/features/roles/actions';
import { RoleForm } from '@/features/roles/components/role-form';

export const metadata: Metadata = { title: 'New role' };

const groups = PERMISSION_GROUPS.map((g) => ({
  label: g.label,
  permissions: g.permissions.map((p) => ({ key: p, label: actionLabel(p) })),
}));

export default function NewRolePage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/team/roles" className="text-sm text-muted-foreground hover:text-foreground">
          ← Roles & permissions
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">New role</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Name it, pick exactly what it can do, then assign it when inviting a team member.
        </p>
      </div>

      <section className="rounded-xl border border-border bg-card p-6 shadow-card">
        <RoleForm action={createRoleAction} groups={groups} submitLabel="Create role" />
      </section>
    </div>
  );
}
