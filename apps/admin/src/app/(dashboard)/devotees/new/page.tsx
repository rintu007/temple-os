import type { Metadata } from 'next';
import { createDevoteeAction } from '@/features/devotees/actions';
import { DevoteeForm } from '@/features/devotees/components/devotee-form';

export const metadata: Metadata = { title: 'Add devotee' };

export default function NewDevoteePage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Add devotee</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Only the name is required — add contact details as you have them.
        </p>
      </div>
      <div className="rounded-xl border border-border bg-card shadow-card p-6">
        <DevoteeForm action={createDevoteeAction} submitLabel="Add devotee" />
      </div>
    </div>
  );
}
