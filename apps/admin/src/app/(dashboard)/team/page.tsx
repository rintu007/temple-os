import type { Metadata } from 'next';
import Link from 'next/link';
import { Alert, Button } from '@templeos/ui';
import { resendInvitationAction, revokeInvitationAction } from '@/features/members/actions';
import { InviteForm } from '@/features/members/components/invite-form';
import { MemberActions } from '@/features/members/components/member-actions';
import { requireTenantContext } from '@/lib/session';
import { billingService, memberService, planService, roleService } from '@/lib/services';

export const metadata: Metadata = { title: 'Team' };

export default async function TeamPage() {
  const { ctx, user, membership } = await requireTenantContext();
  const isOwner = membership.roleKey === 'owner';
  const [members, invites, roles, status] = await Promise.all([
    memberService().listMembers(ctx),
    memberService().listInvitations(ctx),
    roleService().listRoles(ctx),
    billingService().getStatus(ctx),
  ]);

  if (!members.ok) {
    return <Alert tone="error">{members.error.message}</Alert>;
  }
  const invitableRoles = roles.ok ? roles.value.filter((r) => r.key !== 'owner') : [];

  const plan = status.ok && status.value ? await planService().getPlan(status.value.plan) : null;
  const seatLimit = plan?.seatLimit ?? null;
  const seatsUsed = members.value.length + (invites.ok ? invites.value.length : 0);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Team</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            People with access to this organization&apos;s admin portal.
          </p>
        </div>
        <Link
          href="/team/roles"
          className="inline-flex h-9.5 items-center rounded-lg border border-input bg-card px-4 text-sm font-medium shadow-card transition-colors hover:bg-muted/60"
        >
          Roles & permissions
        </Link>
      </div>

      <section className="rounded-xl border border-border bg-card shadow-card p-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-sm font-medium text-muted-foreground">Invite a team member</h2>
          {seatLimit !== null ? (
            <span className="text-xs text-muted-foreground">
              {seatsUsed} of {seatLimit} seats used
              {seatsUsed >= seatLimit ? ' — upgrade to invite more' : ''}
            </span>
          ) : null}
        </div>
        <InviteForm roles={invitableRoles} />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">
          Members ({members.value.length})
        </h2>
        <ul className="divide-y divide-border rounded-xl border border-border bg-card shadow-card">
          {members.value.map((m) => {
            const canManage = m.userId !== user.id && m.roleKey !== 'owner';
            return (
              <li key={m.membershipId} className="flex items-center justify-between gap-4 p-4">
                <div>
                  <div className="font-medium">
                    {m.fullName ?? m.email}
                    {m.userId === user.id ? (
                      <span className="ml-2 text-xs text-muted-foreground">(you)</span>
                    ) : null}
                  </div>
                  <div className="mt-0.5 text-sm text-muted-foreground">{m.email}</div>
                </div>
                {canManage ? (
                  <MemberActions
                    membershipId={m.membershipId}
                    currentRoleKey={m.roleKey}
                    roles={invitableRoles}
                    memberLabel={m.fullName ?? m.email}
                    canTransferOwnership={isOwner}
                  />
                ) : (
                  <span className="rounded-full border border-border px-3 py-1 text-xs font-medium capitalize">
                    {m.roleName}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {invites.ok && invites.value.length > 0 ? (
        <section>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">
            Pending invitations ({invites.value.length})
          </h2>
          <ul className="divide-y divide-border rounded-xl border border-border bg-card shadow-card">
            {invites.value.map((inv) => (
              <li key={inv.id} className="flex items-center justify-between gap-4 p-4">
                <div className="min-w-0">
                  <div className="font-medium">{inv.email}</div>
                  <div className="mt-0.5 truncate text-sm text-muted-foreground">
                    {inv.roleName} · expires{' '}
                    {inv.expiresAt.toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                    })}{' '}
                    ·{' '}
                    <span className="font-mono text-xs">
                      {(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000') +
                        '/invite/' +
                        inv.token}
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <form action={resendInvitationAction.bind(null, inv.id)}>
                    <Button variant="outline" size="sm" type="submit">
                      Resend
                    </Button>
                  </form>
                  <form action={revokeInvitationAction.bind(null, inv.id)}>
                    <Button variant="ghost" size="sm" type="submit">
                      Revoke
                    </Button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
