'use client';

import { useActionState } from 'react';
import { Alert, Button, Input, Textarea } from '@templeos/ui';
import { getDict, type Locale } from '@/i18n/dictionaries';
import { signUpAction, type VolunteerSignupState } from '../actions';

interface SignupFormProps {
  locale: Locale;
  organizationId: string;
  opportunityId: string;
}

const initial: VolunteerSignupState = {};

export function SignupForm({ locale, organizationId, opportunityId }: SignupFormProps) {
  const t = getDict(locale);
  const [state, formAction, pending] = useActionState(
    signUpAction.bind(null, organizationId),
    initial,
  );

  if (state.ok) {
    return <Alert tone="success">{t.volunteer.thanks(state.name ?? '')}</Alert>;
  }

  return (
    <form action={formAction} className="mt-4 space-y-3">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      <input type="hidden" name="opportunityId" value={opportunityId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Input name="name" placeholder={t.volunteer.yourName} required minLength={2} />
        <Input name="phone" type="tel" placeholder={t.volunteer.phone} />
      </div>
      <Input name="email" type="email" placeholder={t.volunteer.email} />
      <Textarea name="note" rows={2} placeholder={t.volunteer.note} maxLength={500} />
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? t.volunteer.signingUp : t.volunteer.signUp}
      </Button>
    </form>
  );
}
