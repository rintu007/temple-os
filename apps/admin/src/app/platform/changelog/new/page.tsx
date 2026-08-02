import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@templeos/ui';
import { ChangelogEntryForm } from '@/features/changelog/components/changelog-entry-form';
import { requirePlatformAdmin } from '@/lib/session';

export const metadata: Metadata = { title: 'New changelog entry · Platform' };

export default async function NewChangelogEntryPage() {
  await requirePlatformAdmin();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href="/platform/changelog"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Changelog
        </Link>
      </div>

      <PageHeader title="New changelog entry" />

      <section className="rounded-xl border border-border bg-card p-6 shadow-card">
        <ChangelogEntryForm />
      </section>
    </div>
  );
}
