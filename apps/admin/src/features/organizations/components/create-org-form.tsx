'use client';

import { useActionState, useState } from 'react';
import { Alert, Button, Input, Label, Select } from '@templeos/ui';
import { initialFormState } from '@/lib/form-state';
import { createOrganizationAction } from '../actions';

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63);
}

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'localhost';

export function CreateOrgForm() {
  const [state, action, pending] = useActionState(createOrganizationAction, initialFormState);
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);

  return (
    <form action={action} className="space-y-4">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}

      <div className="space-y-2">
        <Label htmlFor="name">Temple / organization name</Label>
        <Input
          id="name"
          name="name"
          placeholder="Sri Kalibari Temple"
          required
          onChange={(e) => {
            if (!slugTouched) setSlug(slugify(e.target.value));
          }}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="slug">Web address</Label>
        <div className="flex items-center gap-2">
          <Input
            id="slug"
            name="slug"
            value={slug}
            placeholder="kalibari"
            required
            className="flex-1"
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(slugify(e.target.value));
            }}
          />
          <span className="whitespace-nowrap text-sm text-muted-foreground">.{ROOT_DOMAIN}</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Your temple&apos;s public website address. You can connect a custom domain later.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="country">Country</Label>
        <Select id="country" name="country" defaultValue="IN" required>
          <option value="IN">India (₹ INR)</option>
          <option value="BD">Bangladesh (৳ BDT)</option>
        </Select>
      </div>

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? 'Creating your temple…' : 'Create temple'}
      </Button>
    </form>
  );
}
