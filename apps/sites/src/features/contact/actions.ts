'use server';

import { renderContactMessageEmail, sendEmail } from '@templeos/email';
import { websiteService } from '@/lib/services';

export interface ContactFormState {
  error?: string;
  message?: string;
}

export async function submitContactAction(
  organizationId: string,
  organizationName: string,
  _prev: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  const field = (name: string) => {
    const v = formData.get(name);
    return typeof v === 'string' ? v : '';
  };
  const input = {
    name: field('name'),
    email: field('email'),
    phone: field('phone'),
    message: field('message'),
  };

  const result = await websiteService().submitContactMessage(organizationId, input);
  if (!result.ok) return { error: result.error.message };

  // Best-effort notification to the temple; the message is stored regardless.
  if (result.value.notifyEmail) {
    const { subject, html } = renderContactMessageEmail({
      organizationName,
      senderName: result.value.senderName,
      senderEmail: input.email || null,
      senderPhone: input.phone || null,
      message: result.value.message,
    });
    await sendEmail({ to: result.value.notifyEmail, subject, html });
  }

  return {
    message: `Thank you, ${result.value.senderName} — your message has been sent. The temple will get back to you soon.`,
  };
}
