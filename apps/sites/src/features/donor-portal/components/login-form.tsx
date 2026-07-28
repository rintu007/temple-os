'use client';

import { useActionState } from 'react';
import { Alert, Button, Input, Label } from '@templeos/ui';
import { requestPortalLoginAction, type PortalLoginFormState } from '../actions';

const initialState: PortalLoginFormState = {};

interface LoginFormProps {
  organizationId: string;
  organizationName: string;
  emailLabel: string;
  submitLabel: string;
  sendingLabel: string;
}

export function LoginForm({
  organizationId,
  organizationName,
  emailLabel,
  submitLabel,
  sendingLabel,
}: LoginFormProps) {
  const [state, formAction, pending] = useActionState(
    requestPortalLoginAction.bind(null, organizationId, organizationName),
    initialState,
  );

  if (state.message) {
    return <Alert tone="success">{state.message}</Alert>;
  }

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      <div className="space-y-2">
        <Label htmlFor="portal-email">{emailLabel}</Label>
        <Input id="portal-email" name="email" type="email" required autoFocus />
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? sendingLabel : submitLabel}
      </Button>
    </form>
  );
}
