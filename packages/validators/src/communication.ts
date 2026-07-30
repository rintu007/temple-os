import { z } from 'zod';

export const BROADCAST_SEGMENTS = ['all', 'donors', 'members'] as const;
export type BroadcastSegment = (typeof BROADCAST_SEGMENTS)[number];

export const BROADCAST_SEGMENT_LABELS: Record<BroadcastSegment, string> = {
  all: 'All active devotees',
  donors: 'Devotees who have donated',
  members: 'Current members',
};

export const BROADCAST_CHANNELS = ['email', 'whatsapp'] as const;
export type BroadcastChannel = (typeof BROADCAST_CHANNELS)[number];

export const BROADCAST_CHANNEL_LABELS: Record<BroadcastChannel, string> = {
  email: 'Email',
  whatsapp: 'WhatsApp',
};

export const composeBroadcastSchema = z.object({
  subject: z.string().trim().min(3, 'Add a subject line').max(150),
  message: z.string().trim().min(10, 'Write a longer message').max(5000),
  segment: z.enum(BROADCAST_SEGMENTS),
  channel: z.enum(BROADCAST_CHANNELS).default('email'),
});
export type ComposeBroadcastInput = z.infer<typeof composeBroadcastSchema>;
