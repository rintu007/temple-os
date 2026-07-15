import type { Metadata } from 'next';
import { Alert, Button } from '@templeos/ui';
import { revokeInvitationAction } from '@/features/members/actions';
import { InviteForm } from '@/features/members/components/invite-form';
import { requireTenantContext } from '@/lib/session';
import { memberService } from '@/lib/services';

export const metadata: Metadata = { title: 'Team' };

export default async function TeamPage() {
  const { ctx, user } = await requireTenantContext();
  const [members, invites] = await Promise.all([
    memberService().listMembers(ctx),
    memberService().listInvitations(ctx),
  ]);

  if (!members.ok) {
    return <Alert tone="error">{members.error.message}</Alert>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Team</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          People with access to this organization&apos;s admin portal.
        </p>
      </div>

      <section className="rounded-xl border border-border p-6">
        <h2 className="mb-4 text-sm font-medium text-muted-foreground">Invite a team member</h2>
        <InviteForm />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">
          Members ({members.value.length})
        </h2>
        <ul className="divide-y divide-border rounded-xl border border-border">
          {members.value.map((m) => (
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
              <span className="rounded-full border border-border px-3 py-1 text-xs font-medium capitalize">
                {m.roleName}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {invites.ok && invites.value.length > 0 ? (
        <section>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">
            Pending invitations ({invites.value.length})
          </h2>
          <ul className="divide-y divide-border rounded-xl border border-border">
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
                <form action={revokeInvitationAction.bind(null, inv.id)}>
                  <Button variant="ghost" size="sm" type="submit">
                    Revoke
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
