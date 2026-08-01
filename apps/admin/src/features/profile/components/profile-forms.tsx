'use client';

import { useActionState } from 'react';
import { Alert, Button, Input, Label } from '@templeos/ui';
import { initialFormState } from '@/lib/form-state';
import {
  changeAccountPasswordAction,
  changeEmailAction,
  updateProfileAction,
} from '../actions';

export function NameForm({ fullName }: { fullName: string | null }) {
  const [state, action, pending] = useActionState(updateProfileAction, initialFormState);

  return (
    <form action={action} className="space-y-4">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.message ? <Alert tone="success">{state.message}</Alert> : null}
      <div className="space-y-2">
        <Label htmlFor="fullName">Full name</Label>
        <Input id="fullName" name="fullName" defaultValue={fullName ?? ''} maxLength={120} required />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? 'Saving…' : 'Save name'}
      </Button>
    </form>
  );
}

export function EmailForm({ currentEmail }: { currentEmail: string }) {
  const [state, action, pending] = useActionState(changeEmailAction, initialFormState);

  return (
    <form action={action} className="space-y-4">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.message ? <Alert tone="success">{state.message}</Alert> : null}
      <div className="space-y-2">
        <Label htmlFor="newEmail">New email</Label>
        <Input
          id="newEmail"
          name="newEmail"
          type="email"
          placeholder={currentEmail}
          autoComplete="email"
          required
        />
        <p className="text-xs text-muted-foreground">
          Currently signed in as <span className="font-medium">{currentEmail}</span>. You&apos;ll
          need to confirm the new address before it takes effect.
        </p>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? 'Sending…' : 'Change email'}
      </Button>
    </form>
  );
}

export function PasswordForm() {
  const [state, action, pending] = useActionState(changeAccountPasswordAction, initialFormState);

  return (
    <form action={action} className="space-y-4">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.message ? <Alert tone="success">{state.message}</Alert> : null}
      <div className="space-y-2">
        <Label htmlFor="currentPassword">Current password</Label>
        <Input
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
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
      <Button type="submit" disabled={pending}>
        {pending ? 'Saving…' : 'Change password'}
      </Button>
    </form>
  );
}
