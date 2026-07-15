'use client';

import { useActionState } from 'react';
import { Alert, Button } from '@templeos/ui';
import { initialFormState, type FormState } from '@/lib/form-state';

interface AcceptInviteButtonProps {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  organizationName: string;
}

export function AcceptInviteButton({ action, organizationName }: AcceptInviteButtonProps) {
  const [state, formAction, pending] = useActionState(action, initialFormState);

  return (
    <form action={formAction} className="space-y-3">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? 'Joining…' : `Join ${organizationName}`}
      </Button>
    </form>
  );
}
