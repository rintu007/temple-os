import type { Metadata } from 'next';
import { createTempleAction } from '@/features/temples/actions';
import { TempleForm } from '@/features/temples/components/temple-form';

export const metadata: Metadata = { title: 'Add temple' };

export default function NewTemplePage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Add temple</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The profile appears on your public website. You can edit everything later.
        </p>
      </div>
      <div className="rounded-xl border border-border bg-card shadow-card p-6">
        <TempleForm action={createTempleAction} submitLabel="Create temple" />
      </div>
    </div>
  );
}
