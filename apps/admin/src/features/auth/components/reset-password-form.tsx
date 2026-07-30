'use client';

import { useActionState } from 'react';
import { Alert, Button, Input, Label } from '@templeos/ui';
import { initialFormState } from '@/lib/form-state';
import { updatePasswordAction } from '../actions';

export function ResetPasswordForm() {
  const [state, action, pending] = useActionState(updatePasswordAction, initialFormState);

  return (
    <form action={action} className="space-y-4">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      <div className="space-y-2">
        <Label htmlFor="password">New password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          maxLength={72}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirm new password</Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          minLength={8}
          maxLength={72}
          required
        />
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? 'Saving…' : 'Set new password'}
      </Button>
    </form>
  );
}
