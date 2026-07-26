'use client';

import { useActionState } from 'react';
import type { SegmentCounts } from '@templeos/core';
import { BROADCAST_SEGMENTS, BROADCAST_SEGMENT_LABELS } from '@templeos/validators';
import { Alert, Button, Input, Label, Select, Textarea } from '@templeos/ui';
import { initialFormState } from '@/lib/form-state';
import { sendBroadcastAction } from '../actions';

export function ComposeForm({ counts }: { counts: SegmentCounts }) {
  const [state, formAction, pending] = useActionState(sendBroadcastAction, initialFormState);

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.message ? <Alert tone="success">{state.message}</Alert> : null}

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
          Only active devotees with an email address are included. Family members sharing an
          address are mailed once.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="subject">Subject</Label>
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
