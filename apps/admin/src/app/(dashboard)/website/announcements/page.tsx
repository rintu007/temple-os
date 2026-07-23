import type { Metadata } from 'next';
import Link from 'next/link';
import { Alert, Badge, Button } from '@templeos/ui';
import {
  deleteAnnouncementAction,
  setAnnouncementStatusAction,
} from '@/features/website/announcement-actions';
import { AnnouncementForm } from '@/features/website/components/announcement-form';
import { requireTenantContext } from '@/lib/session';
import { websiteService } from '@/lib/services';

export const metadata: Metadata = { title: 'Announcements' };

export default async function AnnouncementsPage() {
  const { ctx } = await requireTenantContext();
  const result = await websiteService().listAnnouncements(ctx);
  if (!result.ok) return <Alert tone="error">{result.error.message}</Alert>;
  const items = result.value;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/website" className="text-sm text-muted-foreground hover:text-foreground">
          ← Website
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Announcements</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Notices for your devotees — published ones appear on your website immediately.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card shadow-card p-6">
        <AnnouncementForm />
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <h2 className="font-medium">No announcements yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Special timings, closures, festival appeals — post them here.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card shadow-card">
          {items.map((a) => (
            <li key={a.id} className="flex flex-wrap items-start justify-between gap-4 p-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 font-medium">
                  {a.title}
                  {a.status === 'published' ? (
                    <Badge variant="success">Published</Badge>
                  ) : (
                    <Badge variant="outline">Draft</Badge>
                  )}
                </div>
                {a.body ? (
                  <p className="mt-1 text-sm whitespace-pre-line text-muted-foreground">{a.body}</p>
                ) : null}
                <p className="mt-1 text-xs text-muted-foreground">
                  {a.status === 'published' && a.publishedAt
                    ? `Published ${a.publishedAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`
                    : `Created ${a.createdAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <form
                  action={setAnnouncementStatusAction.bind(
                    null,
                    a.id,
                    a.status === 'published' ? 'draft' : 'published',
                  )}
                >
                  <Button
                    variant={a.status === 'published' ? 'outline' : 'primary'}
                    size="sm"
                    type="submit"
                  >
                    {a.status === 'published' ? 'Unpublish' : 'Publish'}
                  </Button>
                </form>
                <form action={deleteAnnouncementAction.bind(null, a.id)}>
                  <Button variant="ghost" size="sm" type="submit">
                    Delete
                  </Button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
