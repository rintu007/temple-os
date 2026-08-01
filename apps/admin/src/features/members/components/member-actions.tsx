'use client';

import { useActionState } from 'react';
import { Alert, Button, Select } from '@templeos/ui';
import { initialFormState } from '@/lib/form-state';
import { removeMemberAction, updateMemberRoleAction } from '../actions';

interface RoleOption {
  key: string;
  name: string;
}

export function MemberActions({
  membershipId,
  currentRoleKey,
  roles,
}: {
  membershipId: string;
  currentRoleKey: string;
  roles: RoleOption[];
}) {
  const [roleState, roleAction, rolePending] = useActionState(
    updateMemberRoleAction.bind(null, membershipId),
    initialFormState,
  );
  const [removeState, removeAction, removePending] = useActionState(
    removeMemberAction.bind(null, membershipId),
    initialFormState,
  );

  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <form action={roleAction}>
          <Select
            name="roleKey"
            defaultValue={currentRoleKey}
            className="h-8 text-xs"
            onChange={(e) => e.currentTarget.form?.requestSubmit()}
            disabled={rolePending}
          >
            {roles.map((r) => (
              <option key={r.key} value={r.key}>
                {r.name}
              </option>
            ))}
          </Select>
        </form>
        <form action={removeAction}>
          <Button variant="ghost" size="sm" type="submit" disabled={removePending}>
            Remove
          </Button>
        </form>
      </div>
      {roleState.error ? (
        <Alert tone="error" className="max-w-64 py-1.5 text-xs">
          {roleState.error}
        </Alert>
      ) : null}
      {removeState.error ? (
        <Alert tone="error" className="max-w-64 py-1.5 text-xs">
          {removeState.error}
        </Alert>
      ) : null}
    </div>
  );
}
