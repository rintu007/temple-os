import type { Metadata } from 'next';
import Link from 'next/link';
import { Alert } from '@templeos/ui';
import { SettingsForm } from '@/features/website/components/settings-form';
import { requireTenantContext } from '@/lib/session';
import { websiteService } from '@/lib/services';

export const metadata: Metadata = { title: 'Website' };

function siteUrl(slug: string): string {
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'localhost';
  return process.env.NODE_ENV === 'production'
    ? `https://${slug}.${root}`
    : `http://${slug}.${root}:3001`;
}

export default async function WebsitePage() {
  const { ctx, membership } = await requireTenantContext();
  const [settings, messages] = await Promise.all([
    websiteService().getSettings(ctx),
    websiteService().listMessages(ctx, { pageSize: 1 }),
  ]);

  if (!settings.ok) {
    return <Alert tone="error">{settings.error.message}</Alert>;
  }
  const newCount = messages.ok ? messages.value.newCount : 0;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Website</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Content for your public site at{' '}
            <a
              href={siteUrl(membership.organizationSlug)}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-primary hover:underline"
            >
              {siteUrl(membership.organizationSlug).replace(/^https?:\/\//, '')}
            </a>
          </p>
        </div>
        <Link
          href="/website/messages"
          className="relative inline-flex h-10 items-center rounded-md border border-border px-4 text-sm font-medium hover:bg-muted"
        >
          Messages
          {newCount > 0 ? (
            <span className="ml-2 rounded-full bg-primary px-1.5 py-0.5 text-xs font-semibold text-primary-foreground">
              {newCount}
            </span>
          ) : null}
        </Link>
      </div>

      <div className="rounded-xl border border-border p-6">
        <SettingsForm settings={settings.value} />
      </div>
    </div>
  );
}
