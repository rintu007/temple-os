import type { BroadcastSegment } from '@templeos/validators';

export interface BroadcastRecipient {
  name: string;
  email: string;
}

export interface SegmentCounts {
  all: number;
  donors: number;
  members: number;
}

export interface BroadcastSummary {
  id: string;
  subject: string;
  segment: BroadcastSegment;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  status: 'sent' | 'partial' | 'failed';
  sentAt: Date;
}

export interface BroadcastTally {
  recipientCount: number;
  sentCount: number;
  failedCount: number;
}
