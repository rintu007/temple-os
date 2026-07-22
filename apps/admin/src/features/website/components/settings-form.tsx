'use client';

import { useActionState } from 'react';
import type { SiteSettings } from '@templeos/core';
import { Alert, Button, Input, Label, Textarea } from '@templeos/ui';
import { initialFormState } from '@/lib/form-state';
import { updateSiteSettingsAction } from '../actions';

export function SettingsForm({ settings }: { settings: SiteSettings }) {
  const [state, formAction, pending] = useActionState(updateSiteSettingsAction, initialFormState);

  return (
    <form action={formAction} className="space-y-8">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.message ? <Alert tone="success">{state.message}</Alert> : null}

      <section className="space-y-4">
        <h2 className="text-sm font-medium text-muted-foreground">About your temple</h2>
        <div className="space-y-2">
          <Label htmlFor="tagline">Tagline</Label>
          <Input
            id="tagline"
            name="tagline"
            defaultValue={settings.tagline ?? ''}
            placeholder="A home of devotion since 1952"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="aboutText">About (shown on your About page)</Label>
          <Textarea
            id="aboutText"
            name="aboutText"
            rows={6}
            defaultValue={settings.aboutText ?? ''}
            placeholder="Tell devotees about your temple, deities and daily worship…"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="historyText">History</Label>
          <Textarea
            id="historyText"
            name="historyText"
            rows={6}
            defaultValue={settings.historyText ?? ''}
            placeholder="The story of how the temple came to be…"
          />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-medium text-muted-foreground">Contact details</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="contactEmail">Email (contact-form messages arrive here)</Label>
            <Input
              id="contactEmail"
              name="contactEmail"
              type="email"
              defaultValue={settings.contactEmail ?? ''}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contactPhone">Phone</Label>
            <Input
              id="contactPhone"
              name="contactPhone"
              type="tel"
              defaultValue={settings.contactPhone ?? ''}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="addressText">Address</Label>
          <Textarea
            id="addressText"
            name="addressText"
            rows={3}
            defaultValue={settings.addressText ?? ''}
          />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-medium text-muted-foreground">Social links</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="facebookUrl">Facebook</Label>
            <Input
              id="facebookUrl"
              name="facebookUrl"
              defaultValue={settings.facebookUrl ?? ''}
              placeholder="https://facebook.com/…"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="instagramUrl">Instagram</Label>
            <Input
              id="instagramUrl"
              name="instagramUrl"
              defaultValue={settings.instagramUrl ?? ''}
              placeholder="https://instagram.com/…"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="youtubeUrl">YouTube</Label>
            <Input
              id="youtubeUrl"
              name="youtubeUrl"
              defaultValue={settings.youtubeUrl ?? ''}
              placeholder="https://youtube.com/…"
            />
          </div>
        </div>
      </section>

      <Button type="submit" disabled={pending}>
        {pending ? 'Saving…' : 'Save website content'}
      </Button>
    </form>
  );
}
