'use client';

import { useActionState } from 'react';
import { Alert, Button, Input, Label, Select } from '@templeos/ui';
import { createInvitationAction, type InviteFormState } from '../actions';

const initialState: InviteFormState = {};

const SYSTEM_ROLE_LABELS: Record<string, string> = {
  admin: 'Administrator — full access',
  manager: 'Manager — temples, devotees, donations, events',
  staff: 'Staff — day-to-day entry, no voiding',
  viewer: 'Viewer — read only',
};

interface InviteFormProps {
  roles: Array<{ key: string; name: string; isSystem: boolean }>;
}

export function InviteForm({ roles }: InviteFormProps) {
  const [state, formAction, pending] = useActionState(createInvitationAction, initialState);

  return (
    <div className="space-y-4">
      <form action={formAction} className="space-y-4">
        {state.error ? <Alert tone="error">{state.error}</Alert> : null}
        <div className="grid gap-4 sm:grid-cols-[1fr_auto_auto] sm:items-end">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" placeholder="colleague@example.com" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="roleKey">Role</Label>
            <Select id="roleKey" name="roleKey" defaultValue="staff" className="sm:w-72">
              {roles.map((r) => (
                <option key={r.key} value={r.key}>
                  {r.isSystem ? (SYSTEM_ROLE_LABELS[r.key] ?? r.name) : `${r.name} (custom)`}
                </option>
              ))}
            </Select>
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? 'Creating…' : 'Invite'}
          </Button>
        </div>
      </form>

      {state.inviteUrl ? (
        <Alert tone="success">
          <p className="font-medium">{state.message}</p>
          <p className="mt-1">
            {state.emailSent
              ? 'An email invitation was sent. You can also share this link directly — it expires in 7 days:'
              : 'Could not send an email (check RESEND_API_KEY) — share this link directly instead, it expires in 7 days:'}
          </p>
          <Input readOnly value={state.inviteUrl} className="mt-2 bg-background font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
        </Alert>
      ) : null}
    </div>
  );
}
