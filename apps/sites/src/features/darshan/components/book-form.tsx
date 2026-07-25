'use client';

import { useActionState } from 'react';
import { Alert, Button, Input } from '@templeos/ui';
import { getDict, type Locale } from '@/i18n/dictionaries';
import { bookTokenAction, type DarshanBookState } from '../actions';

interface BookFormProps {
  locale: Locale;
  organizationId: string;
  slotId: string;
}

const initial: DarshanBookState = {};

export function BookForm({ locale, organizationId, slotId }: BookFormProps) {
  const t = getDict(locale);
  const [state, formAction, pending] = useActionState(
    bookTokenAction.bind(null, organizationId),
    initial,
  );

  if (state.ok && state.tokenNumber) {
    return <Alert tone="success">{t.darshan.thanks(state.tokenNumber, state.devoteeName ?? '')}</Alert>;
  }

  return (
    <form action={formAction} className="mt-4 space-y-3">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      <input type="hidden" name="slotId" value={slotId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Input name="devoteeName" placeholder={t.darshan.yourName} required minLength={2} />
        <Input name="phone" type="tel" placeholder={t.darshan.phone} required />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          name="partySize"
          type="number"
          min="1"
          defaultValue={1}
          aria-label={t.darshan.partySize}
          required
        />
        <Input name="email" type="email" placeholder={t.darshan.email} />
      </div>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? t.darshan.booking : t.darshan.book}
      </Button>
    </form>
  );
}
