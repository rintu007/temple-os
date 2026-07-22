import type { Metadata } from 'next';
import Link from 'next/link';
import { Alert, Button, cn } from '@templeos/ui';
import { markMessageReadAction } from '@/features/website/actions';
import { requireTenantContext } from '@/lib/session';
import { websiteService } from '@/lib/services';

export const metadata: Metadata = { title: 'Messages' };

interface MessagesPageProps {
  searchParams: Promise<{ page?: string }>;
}

export default async function MessagesPage({ searchParams }: MessagesPageProps) {
  const { page } = await searchParams;
  const { ctx } = await requireTenantContext();

  const result = await websiteService().listMessages(ctx, { page: page ?? 1 });
  if (!result.ok) {
    return <Alert tone="error">{result.error.message}</Alert>;
  }
  const { items, total, newCount, page: currentPage, pageSize } = result.value;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/website" className="text-sm text-muted-foreground hover:text-foreground">
          ← Website
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Contact messages</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {total} message{total === 1 ? '' : 's'}
          {newCount > 0 ? ` · ${newCount} new` : ''} from your website&apos;s contact form.
        </p>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <h2 className="font-medium">No messages yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Messages devotees send from your Contact page appear here.
          </p>
        </div>
      ) : (
        <>
          <ul className="space-y-3">
            {items.map((m) => (
              <li
                key={m.id}
                className={cn(
                  'rounded-xl border border-border p-5',
                  m.status === 'new' && 'border-primary/40 bg-primary/5',
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 font-medium">
                      {m.name}
                      {m.status === 'new' ? (
                        <span className="rounded bg-primary px-1.5 py-0.5 text-xs font-semibold text-primary-foreground">
                          New
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-0.5 text-sm text-muted-foreground">
                      {[m.email, m.phone].filter(Boolean).join(' · ')} ·{' '}
                      {m.createdAt.toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </div>
                  </div>
                  {m.status === 'new' ? (
                    <form action={markMessageReadAction.bind(null, m.id)}>
                      <Button variant="outline" size="sm" type="submit">
                        Mark read
                      </Button>
                    </form>
                  ) : null}
                </div>
                <p className="mt-3 whitespace-pre-line text-sm">{m.message}</p>
              </li>
            ))}
          </ul>

          {totalPages > 1 ? (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Page {currentPage} of {totalPages}
              </span>
              <div className="flex gap-2">
                {currentPage > 1 ? (
                  <Link
                    href={`/website/messages?page=${currentPage - 1}`}
                    className="text-primary hover:underline"
                  >
                    ← Previous
                  </Link>
                ) : null}
                {currentPage < totalPages ? (
                  <Link
                    href={`/website/messages?page=${currentPage + 1}`}
                    className="text-primary hover:underline"
                  >
                    Next →
                  </Link>
                ) : null}
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
