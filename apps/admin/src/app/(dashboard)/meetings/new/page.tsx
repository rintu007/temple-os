import type { Metadata } from 'next';
import Link from 'next/link';
import { createMeetingAction } from '@/features/meetings/actions';
import { MeetingForm } from '@/features/meetings/components/meeting-form';

export const metadata: Metadata = { title: 'New meeting' };

export default function NewMeetingPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/meetings" className="text-sm text-muted-foreground hover:text-foreground">
          ← Meetings
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">New meeting</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Schedule a meeting with its agenda now; add the minutes after it&apos;s held.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 shadow-card">
        <MeetingForm action={createMeetingAction} submitLabel="Create meeting" />
      </div>
    </div>
  );
}
