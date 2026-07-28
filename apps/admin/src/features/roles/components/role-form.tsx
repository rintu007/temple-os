'use client';

import { useActionState, useState } from 'react';
import { Alert, Button, Input, Label } from '@templeos/ui';
import { initialFormState, type FormState } from '@/lib/form-state';

export interface PermissionGroupOption {
  label: string;
  permissions: Array<{ key: string; label: string }>;
}

interface RoleFormProps {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  groups: PermissionGroupOption[];
  role?: { name: string; permissionKeys: string[] };
  submitLabel: string;
}

export function RoleForm({ action, groups, role, submitLabel }: RoleFormProps) {
  const [state, formAction, pending] = useActionState(action, initialFormState);
  const [checked, setChecked] = useState<Set<string>>(new Set(role?.permissionKeys ?? []));

  function toggleGroup(keys: string[], next: boolean) {
    setChecked((prev) => {
      const copy = new Set(prev);
      for (const k of keys) {
        if (next) copy.add(k);
        else copy.delete(k);
      }
      return copy;
    });
  }

  return (
    <form action={formAction} className="space-y-6">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.message ? <Alert tone="success">{state.message}</Alert> : null}

      <div className="max-w-sm space-y-2">
        <Label htmlFor="name">Role name</Label>
        <Input id="name" name="name" defaultValue={role?.name} required minLength={2} placeholder="Treasurer" />
      </div>

      <div className="space-y-3">
        <Label>Permissions ({checked.size} selected)</Label>
        <div className="grid gap-3 sm:grid-cols-2">
          {groups.map((group) => {
            const keys = group.permissions.map((p) => p.key);
            const allChecked = keys.every((k) => checked.has(k));
            return (
              <div key={group.label} className="rounded-lg border border-border p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{group.label}</span>
                  <button
                    type="button"
                    onClick={() => toggleGroup(keys, !allChecked)}
                    className="text-xs text-primary hover:underline"
                  >
                    {allChecked ? 'Clear' : 'All'}
                  </button>
                </div>
                <div className="flex flex-col gap-1.5">
                  {group.permissions.map((p) => (
                    <label key={p.key} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        name="permissionKeys"
                        value={p.key}
                        checked={checked.has(p.key)}
                        onChange={(e) =>
                          setChecked((prev) => {
                            const copy = new Set(prev);
                            if (e.target.checked) copy.add(p.key);
                            else copy.delete(p.key);
                            return copy;
                          })
                        }
                        className="size-4 rounded border-input"
                      />
                      {p.label}
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? 'Saving…' : submitLabel}
      </Button>
    </form>
  );
}
