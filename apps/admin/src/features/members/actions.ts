'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { renderInvitationEmail, sendEmail } from '@templeos/email';
import type { FormState } from '@/lib/form-state';
import { memberService } from '@/lib/services';
import { getSessionUser, requireTenantContext } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';

export interface InviteFormState extends FormState {
  /** Shareable link for the invitation just created. */
  inviteUrl?: string;
  emailSent?: boolean;
}

export async function createInvitationAction(
  _prev: InviteFormState,
  formData: FormData,
): Promise<InviteFormState> {
  const { ctx, user, membership } = await requireTenantContext();
  const email = formData.get('email');
  const roleKey = formData.get('roleKey');

  const result = await memberService().createInvitation(ctx, {
    email: typeof email === 'string' ? email : '',
    roleKey: typeof roleKey === 'string' ? roleKey : '',
  });
  if (!result.ok) return { error: result.error.message };

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const inviteUrl = `${appUrl}/invite/${result.value.token}`;

  const invitedByName = user.user_metadata?.full_name;
  const { subject, html } = renderInvitationEmail({
    organizationName: membership.organizationName,
    roleName: result.value.roleName,
    inviteUrl,
    invitedByName: typeof invitedByName === 'string' ? invitedByName : user.email,
  });
  const emailSent = await sendEmail({ to: result.value.email, subject, html });

  revalidatePath('/team');
  return {
    message: `Invitation created for ${result.value.email}`,
    inviteUrl,
    emailSent,
  };
}

export async function revokeInvitationAction(invitationId: string): Promise<void> {
  const { ctx } = await requireTenantContext();
  await memberService().revokeInvitation(ctx, invitationId);
  revalidatePath('/team');
}

export async function acceptInvitationAction(
  token: string,
  _prev: FormState,
  _formData: FormData,
): Promise<FormState> {
  const user = await getSessionUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/invite/${token}`)}`);

  const fullName = user.user_metadata?.full_name;
  const result = await memberService().acceptInvitation(token, {
    userId: user.id,
    email: user.email ?? '',
    fullName: typeof fullName === 'string' ? fullName : null,
  });
  if (!result.ok) return { error: result.error.message };
  redirect('/');
}

/** Invite pages live outside the dashboard shell, so they need their own sign-out. */
export async function signOutFromInviteAction(token: string): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(`/invite/${token}`);
}
