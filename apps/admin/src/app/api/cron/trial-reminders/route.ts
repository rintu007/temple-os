import { NextResponse } from 'next/server';
import { renderTrialEndingEmail, sendEmail } from '@templeos/email';
import { billingService } from '@/lib/services';

/**
 * Scheduled by Vercel Cron (see apps/admin/vercel.json) — emails organizations
 * whose trial ends within REMINDER_WINDOW_DAYS and haven't been reminded yet.
 * Vercel signs its own cron requests with `Authorization: Bearer
 * $CRON_SECRET` when CRON_SECRET is set as a project env var; this route
 * rejects anything else so it can't be triggered by an outside request.
 */
const REMINDER_WINDOW_DAYS = 3;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 503 });
  }
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/$/, '');
  const trials = await billingService().listTrialsEndingSoon(REMINDER_WINDOW_DAYS);

  let sent = 0;
  for (const trial of trials) {
    const { subject, html } = renderTrialEndingEmail({
      organizationName: trial.organizationName,
      trialEndsAt: trial.trialEndsAt,
      billingUrl: `${appUrl}/billing`,
    });
    const ok = await sendEmail({ to: trial.ownerEmail, subject, html });
    if (ok) sent += 1;
    // Mark reminded regardless of send success — a Resend outage shouldn't
    // cause the same org to be retried (and potentially double-emailed once
    // Resend recovers) on every run until the trial actually ends.
    await billingService().markTrialReminderSent(trial.organizationId);
  }

  return NextResponse.json({ checked: trials.length, sent });
}
