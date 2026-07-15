import type { Metadata } from 'next';
import Link from 'next/link';
import { Alert, Button } from '@templeos/ui';
import { acceptInvitationAction, signOutFromInviteAction } from '@/features/members/actions';
import { AcceptInviteButton } from '@/features/members/components/accept-invite-button';
import { memberService } from '@/lib/services';
import { getSessionUser } from '@/lib/session';

export const metadata: Metadata = { title: 'Invitation' };

interface InvitePageProps {
  params: Promise<{ token: string }>;
}

export default async function InvitePage({ params }: InvitePageProps) {
  const { token } = await params;
  const [preview, user] = await Promise.all([
    memberService().previewInvitation(token),
    getSessionUser(),
  ]);

  const invitePath = `/invite/${token}`;

  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted/40 p-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <span className="text-lg font-semibold tracking-tight">
            Temple<span className="text-primary">OS</span>
          </span>
        </div>
        <div className="rounded-xl border border-border bg-background p-8 shadow-sm">
          {!preview ? (
            <>
              <h1 className="text-xl font-semibold tracking-tight">Invitation not found</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                This link is invalid. Ask your administrator to send a new invitation.
              </p>
            </>
          ) : preview.state !== 'valid' ? (
            <>
              <h1 className="text-xl font-semibold tracking-tight">
                Invitation {preview.state === 'expired' ? 'expired' : preview.state}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {preview.state === 'accepted'
                  ? 'This invitation has already been used. If that was you, just sign in.'
                  : 'Ask your administrator to send a new invitation link.'}
              </p>
              {preview.state === 'accepted' ? (
                <Link
                  href="/login"
                  className="mt-4 inline-block text-sm font-medium text-primary hover:underline"
                >
                  Go to sign in →
                </Link>
              ) : null}
            </>
          ) : (
            <>
              <h1 className="text-xl font-semibold tracking-tight">
                Join {preview.organizationName}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                You&apos;ve been invited to join <strong>{preview.organizationName}</strong> as{' '}
                <strong>{preview.roleName}</strong>. This invitation is for{' '}
                <strong>{preview.email}</strong>.
              </p>

              <div className="mt-6">
                {user ? (
                  user.email?.toLowerCase() === preview.email.toLowerCase() ? (
                    <AcceptInviteButton
                      action={acceptInvitationAction.bind(null, token)}
                      organizationName={preview.organizationName}
                    />
                  ) : (
                    <div className="space-y-3">
                      <Alert tone="error">
                        You are signed in as {user.email}, but this invitation is for{' '}
                        {preview.email}.
                      </Alert>
                      <form action={signOutFromInviteAction.bind(null, token)}>
                        <Button variant="outline" className="w-full" type="submit">
                          Sign out and switch account
                        </Button>
                      </form>
                    </div>
                  )
                ) : (
                  <div className="space-y-3">
                    <Link
                      href={`/signup?next=${encodeURIComponent(invitePath)}`}
                      className="inline-flex h-10 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90"
                    >
                      Create an account to join
                    </Link>
                    <Link
                      href={`/login?next=${encodeURIComponent(invitePath)}`}
                      className="inline-flex h-10 w-full items-center justify-center rounded-md border border-border px-4 text-sm font-medium hover:bg-muted"
                    >
                      I already have an account
                    </Link>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
