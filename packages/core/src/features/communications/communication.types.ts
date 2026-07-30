import type { BroadcastChannel, BroadcastSegment } from '@templeos/validators';

export interface BroadcastRecipient {
  name: string;
  /** Present when reachable by email — null if this recipient only has a phone. */
  email: string | null;
  /** Present when reachable by WhatsApp — null if this recipient only has an email. */
  phone: string | null;
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
  channel: BroadcastChannel;
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
