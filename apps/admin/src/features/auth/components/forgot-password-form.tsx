'use client';

import { useActionState } from 'react';
import { Alert, Button, Input, Label } from '@templeos/ui';
import { initialFormState } from '@/lib/form-state';
import { requestPasswordResetAction } from '../actions';

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(requestPasswordResetAction, initialFormState);

  if (state.message) {
    return <Alert tone="success">{state.message}</Alert>;
  }

  return (
    <form action={action} className="space-y-4">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? 'Sending…' : 'Send reset link'}
      </Button>
    </form>
  );
}
