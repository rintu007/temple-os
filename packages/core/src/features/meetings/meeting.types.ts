export type MeetingStatus = 'scheduled' | 'held' | 'cancelled';

export interface MeetingSummary {
  id: string;
  title: string;
  body: string | null;
  meetingOn: string;
  location: string | null;
  attendees: string | null;
  agenda: string | null;
  minutes: string | null;
  decisions: string | null;
  status: MeetingStatus;
  createdAt: Date;
}
