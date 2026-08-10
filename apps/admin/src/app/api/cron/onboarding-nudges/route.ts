import { NextResponse } from 'next/server';
import { renderOnboardingNudgeEmail, sendEmail } from '@templeos/email';
import { billingService } from '@/lib/services';

/**
 * Scheduled by Vercel Cron (see apps/admin/vercel.json) — day-1/3/7
 * onboarding drip for organizations created in the last 30 days. Each org
 * gets at most one nudge per run: the earliest day-N threshold it has
 * crossed but not yet been sent, so a missed cron run catches up next time
 * without ever double-sending (see packages/db/sql/0010_onboarding_nudge_function.sql).
 */
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 503 });
  }
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/$/, '');
  const orgs = await billingService().listOrgsForOnboardingNudges();

  let sent = 0;
  for (const org of orgs) {
    const daysSinceCreation = Math.floor((Date.now() - org.createdAt.getTime()) / MS_PER_DAY);

    let day: 1 | 3 | 7 | null = null;
    if (daysSinceCreation >= 1 && !org.onboardingDay1SentAt) day = 1;
    else if (daysSinceCreation >= 3 && !org.onboardingDay3SentAt) day = 3;
    else if (daysSinceCreation >= 7 && !org.onboardingDay7SentAt) day = 7;
    if (day === null) continue;

    const { subject, html } = renderOnboardingNudgeEmail({
      day,
      organizationName: org.organizationName,
      recipientName: org.ownerName,
      dashboardUrl: `${appUrl}/`,
      devoteesUrl: `${appUrl}/devotees`,
      teamUrl: `${appUrl}/team`,
      websiteUrl: `${appUrl}/website`,
      pujasUrl: `${appUrl}/pujas`,
      donationsUrl: `${appUrl}/donations`,
    });
    const ok = await sendEmail({ to: org.ownerEmail, subject, html });
    if (ok) sent += 1;
    // Mark sent regardless of delivery success — same reasoning as the
    // trial-reminder cron: a Resend outage shouldn't cause a retry storm of
    // duplicate nudges once it recovers.
    await billingService().markOnboardingNudgeSent(org.organizationId, day);
  }

  return NextResponse.json({ checked: orgs.length, sent });
}
