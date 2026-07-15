'use client';

import { useActionState } from 'react';
import { Alert, Button, Input, Label, Select } from '@templeos/ui';
import { createInvitationAction, type InviteFormState } from '../actions';

const initialState: InviteFormState = {};

const ROLES = [
  { value: 'admin', label: 'Administrator — full access' },
  { value: 'manager', label: 'Manager — temples, devotees, donations, events' },
  { value: 'staff', label: 'Staff — day-to-day entry, no voiding' },
  { value: 'viewer', label: 'Viewer — read only' },
];

export function InviteForm() {
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
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
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
          <p className="mt-1">Share this link — it expires in 7 days:</p>
          <Input readOnly value={state.inviteUrl} className="mt-2 bg-background font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
        </Alert>
      ) : null}
    </div>
  );
}
