'use server';

import { revalidatePath } from 'next/cache';
import { renderBroadcastEmail, sendEmail } from '@templeos/email';
import { BROADCAST_SEGMENTS, type BroadcastSegment } from '@templeos/validators';
import type { FormState } from '@/lib/form-state';
import { communicationService } from '@/lib/services';
import { requireTenantContext } from '@/lib/session';

function field(formData: FormData, name: string) {
  const v = formData.get(name);
  return typeof v === 'string' ? v : '';
}

function isSegment(v: string): v is BroadcastSegment {
  return (BROADCAST_SEGMENTS as readonly string[]).includes(v);
}

/** Sends emails in small batches so we don't trip the provider's rate limit. */
async function sendInBatches<T>(
  items: T[],
  size: number,
  fn: (item: T) => Promise<boolean>,
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;
  for (let i = 0; i < items.length; i += size) {
    const results = await Promise.all(items.slice(i, i + size).map(fn));
    for (const ok of results) {
      if (ok) sent += 1;
      else failed += 1;
    }
  }
  return { sent, failed };
}

export async function sendBroadcastAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { ctx, membership } = await requireTenantContext();

  const subject = field(formData, 'subject');
  const message = field(formData, 'message');
  const segmentRaw = field(formData, 'segment');
  if (!isSegment(segmentRaw)) return { error: 'Choose a valid audience' };
  const input = { subject, message, segment: segmentRaw };

  const recipientsResult = await communicationService().getRecipients(ctx, segmentRaw);
  if (!recipientsResult.ok) return { error: recipientsResult.error.message };
  const recipients = recipientsResult.value;
  if (recipients.length === 0) {
    return { error: 'No devotees with an email address match that audience' };
  }

  const { sent, failed } = await sendInBatches(recipients, 5, async (r) => {
    const { subject: subj, html } = renderBroadcastEmail({
      organizationName: membership.organizationName,
      subject,
      message,
      recipientName: r.name,
    });
    return sendEmail({ to: r.email, subject: subj, html });
  });

  const recorded = await communicationService().recordBroadcast(ctx, input, {
    recipientCount: recipients.length,
    sentCount: sent,
    failedCount: failed,
  });
  if (!recorded.ok) return { error: recorded.error.message };

  revalidatePath('/communications');
  const summary =
    failed === 0
      ? `Sent to ${sent} recipient${sent === 1 ? '' : 's'}.`
      : `Sent to ${sent}, ${failed} failed.`;
  return { message: summary };
}
