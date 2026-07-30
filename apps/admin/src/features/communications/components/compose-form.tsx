'use client';

import { useActionState, useState } from 'react';
import type { SegmentCounts } from '@templeos/core';
import {
  BROADCAST_CHANNEL_LABELS,
  BROADCAST_CHANNELS,
  BROADCAST_SEGMENTS,
  BROADCAST_SEGMENT_LABELS,
  type BroadcastChannel,
} from '@templeos/validators';
import { Alert, Button, Input, Label, Select, Textarea, cn } from '@templeos/ui';
import { initialFormState } from '@/lib/form-state';
import { sendBroadcastAction } from '../actions';

interface ComposeFormProps {
  countsByChannel: Record<BroadcastChannel, SegmentCounts>;
  whatsappConfigured: boolean;
}

export function ComposeForm({ countsByChannel, whatsappConfigured }: ComposeFormProps) {
  const [state, formAction, pending] = useActionState(sendBroadcastAction, initialFormState);
  const [channel, setChannel] = useState<BroadcastChannel>('email');
  const counts = countsByChannel[channel];

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.message ? <Alert tone="success">{state.message}</Alert> : null}

      <div className="space-y-2">
        <Label>Channel</Label>
        <input type="hidden" name="channel" value={channel} />
        <div className="flex gap-2">
          {BROADCAST_CHANNELS.map((c) => {
            const disabled = c === 'whatsapp' && !whatsappConfigured;
            return (
              <button
                key={c}
                type="button"
                disabled={disabled}
                onClick={() => setChannel(c)}
                className={cn(
                  'rounded-full border px-4 py-1.5 text-sm font-medium transition-colors',
                  channel === c
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-background text-muted-foreground hover:bg-muted/50',
                  disabled && 'cursor-not-allowed opacity-50 hover:bg-background',
                )}
              >
                {BROADCAST_CHANNEL_LABELS[c]}
              </button>
            );
          })}
        </div>
        {!whatsappConfigured ? (
          <p className="text-xs text-muted-foreground">
            WhatsApp isn&apos;t switched on yet — contact us to set it up.
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="segment">Audience</Label>
        <Select id="segment" name="segment" defaultValue="all">
          {BROADCAST_SEGMENTS.map((s) => (
            <option key={s} value={s}>
              {BROADCAST_SEGMENT_LABELS[s]} ({counts[s]})
            </option>
          ))}
        </Select>
        <p className="text-xs text-muted-foreground">
          {channel === 'email'
            ? 'Only active devotees with an email address are included. Family members sharing an address are mailed once.'
            : 'Only active devotees with a phone number are included. Family members sharing a number are messaged once.'}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="subject">{channel === 'email' ? 'Subject' : 'Heading'}</Label>
        <Input id="subject" name="subject" required minLength={3} maxLength={150} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="message">Message</Label>
        <Textarea
          id="message"
          name="message"
          rows={8}
          required
          minLength={10}
          maxLength={5000}
          placeholder={'Dear devotees,\n\nWrite your message here. Leave a blank line between paragraphs.'}
        />
        <p className="text-xs text-muted-foreground">
          Plain text — each recipient is greeted by name automatically.
        </p>
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? 'Sending…' : 'Send broadcast'}
      </Button>
    </form>
  );
}
