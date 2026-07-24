import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Alert } from '@templeos/ui';
import { updateMeetingAction } from '@/features/meetings/actions';
import { MeetingForm } from '@/features/meetings/components/meeting-form';
import { requireTenantContext } from '@/lib/session';
import { meetingService } from '@/lib/services';

export const metadata: Metadata = { title: 'Meeting' };

interface MeetingPageProps {
  params: Promise<{ meetingId: string }>;
}

export default async function MeetingPage({ params }: MeetingPageProps) {
  const { meetingId } = await params;
  const { ctx } = await requireTenantContext();
  const result = await meetingService().getMeeting(ctx, meetingId);
  if (!result.ok) {
    if (result.error.code === 'NOT_FOUND') notFound();
    return <Alert tone="error">{result.error.message}</Alert>;
  }
  const m = result.value;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/meetings" className="text-sm text-muted-foreground hover:text-foreground">
          ← Meetings
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{m.title}</h1>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 shadow-card">
        <MeetingForm
          action={updateMeetingAction.bind(null, meetingId)}
          submitLabel="Save changes"
          defaults={{
            title: m.title,
            body: m.body ?? '',
            meetingOn: m.meetingOn,
            location: m.location ?? '',
            attendees: m.attendees ?? '',
            agenda: m.agenda ?? '',
            minutes: m.minutes ?? '',
            decisions: m.decisions ?? '',
            status: m.status,
          }}
        />
      </div>
    </div>
  );
}
