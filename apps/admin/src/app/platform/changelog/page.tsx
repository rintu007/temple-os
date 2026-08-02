import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@templeos/ui';
import { DeleteChangelogEntryButton } from '@/features/changelog/components/delete-changelog-entry-button';
import { requirePlatformAdmin } from '@/lib/session';
import { changelogService } from '@/lib/services';

export const metadata: Metadata = { title: 'Changelog · Platform' };

export default async function ChangelogPage() {
  const { user } = await requirePlatformAdmin();
  const feed = await changelogService().getFeed(user.id);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/platform" className="text-sm text-muted-foreground hover:text-foreground">
          ← Platform
        </Link>
      </div>

      <PageHeader
        title="Changelog"
        description="What every temple's staff sees in the 'What's new' bell across the admin app."
        actions={
          <Link
            href="/platform/changelog/new"
            className="inline-flex h-9.5 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-card transition-colors hover:bg-primary/90"
          >
            New entry
          </Link>
        }
      />

      <ul className="divide-y divide-border rounded-xl border border-border bg-card shadow-card">
        {feed.items.length === 0 ? (
          <li className="p-6 text-center text-sm text-muted-foreground">
            Nothing published yet.
          </li>
        ) : (
          feed.items.map((entry) => (
            <li key={entry.id} className="flex items-start justify-between gap-4 p-4">
              <div className="min-w-0">
                <div className="font-medium">{entry.title}</div>
                <p className="mt-0.5 text-sm text-muted-foreground">{entry.body}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {entry.publishedAt.toLocaleDateString('en-US', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </p>
              </div>
              <DeleteChangelogEntryButton id={entry.id} />
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
