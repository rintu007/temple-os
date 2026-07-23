'use client';

import { useActionState } from 'react';
import { Alert, Button, Input, Textarea } from '@templeos/ui';
import { getDict, type Locale } from '@/i18n/dictionaries';
import { requestBookingAction, type FacilityRequestState } from '../actions';

interface RequestFormProps {
  locale: Locale;
  organizationId: string;
  facilityId: string;
}

const initial: FacilityRequestState = {};

export function RequestForm({ locale, organizationId, facilityId }: RequestFormProps) {
  const t = getDict(locale);
  const [state, formAction, pending] = useActionState(
    requestBookingAction.bind(null, organizationId),
    initial,
  );

  if (state.ok) {
    return <Alert tone="success">{t.facilities.thanks(state.facilityName ?? '')}</Alert>;
  }

  return (
    <form action={formAction} className="mt-4 space-y-3">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      <input type="hidden" name="facilityId" value={facilityId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Input name="bookerName" placeholder={t.facilities.yourName} required minLength={2} />
        <Input name="phone" type="tel" placeholder={t.facilities.phone} required />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input name="eventDate" type="date" aria-label={t.facilities.date} required />
        <Input name="email" type="email" placeholder={t.facilities.email} />
      </div>
      <Input name="purpose" placeholder={t.facilities.purpose} />
      <Textarea name="note" rows={2} placeholder={t.facilities.note} maxLength={500} />
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? t.facilities.requesting : t.facilities.request}
      </Button>
    </form>
  );
}
