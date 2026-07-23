'use client';

import { useActionState } from 'react';
import { Alert, Button, Input, Label, Textarea } from '@templeos/ui';
import { getDict, type Locale } from '@/i18n/dictionaries';
import { submitContactAction, type ContactFormState } from '../actions';

const initialState: ContactFormState = {};

interface ContactFormProps {
  locale: Locale;
  organizationId: string;
  organizationName: string;
}

export function ContactForm({ locale, organizationId, organizationName }: ContactFormProps) {
  const t = getDict(locale);
  const [state, formAction, pending] = useActionState(
    submitContactAction.bind(null, organizationId, organizationName),
    initialState,
  );

  if (state.message) {
    return <Alert tone="success">{state.message}</Alert>;
  }

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}

      <div className="space-y-2">
        <Label htmlFor="contact-name">{t.forms.yourName}</Label>
        <Input id="contact-name" name="name" required />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="contact-email">{t.contact.email}</Label>
          <Input id="contact-email" name="email" type="email" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contact-phone">{t.forms.phone}</Label>
          <Input id="contact-phone" name="phone" type="tel" />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        {t.contact.replyHint}
      </p>
      <div className="space-y-2">
        <Label htmlFor="contact-message">{t.contact.message}</Label>
        <Textarea id="contact-message" name="message" rows={5} required minLength={10} />
      </div>

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? t.contact.sending : t.contact.send}
      </Button>
    </form>
  );
}
