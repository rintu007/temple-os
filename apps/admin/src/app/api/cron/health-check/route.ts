import { NextResponse } from 'next/server';
import { renderServiceAlertEmail, sendEmail } from '@templeos/email';
import { healthService } from '@/lib/services';

/**
 * Scheduled by Vercel Cron (see apps/admin/vercel.json). Checks DB
 * connectivity directly and the sites app over HTTP; emails every platform
 * admin only on an up→down or down→up transition, never on every run —
 * see health.service.ts#recordCheck.
 */
async function checkSitesApp(): Promise<boolean> {
  const base = (process.env.SITES_APP_URL ?? 'https://templeos-sites.vercel.app').replace(/\/$/, '');
  try {
    const res = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(8_000) });
    return res.ok;
  } catch {
    return false;
  }
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 503 });
  }
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const health = healthService();
  const [dbResult, sitesUp] = await Promise.all([health.checkDb(), checkSitesApp()]);
  const sitesResult = await health.recordExternalCheck('sites-app', sitesUp);

  const changed = [dbResult, sitesResult].filter((r) => r.changed);
  if (changed.length > 0) {
    const recipients = await health.getAlertRecipients();
    const detectedAt = new Date();
    for (const result of changed) {
      const { subject, html } = renderServiceAlertEmail({
        service: result.service,
        status: result.currentStatus,
        detectedAt,
      });
      await Promise.all(recipients.map((r) => sendEmail({ to: r.email, subject, html })));
    }
  }

  return NextResponse.json({
    db: dbResult.currentStatus,
    'sites-app': sitesResult.currentStatus,
    alertsSent: changed.length,
  });
}
