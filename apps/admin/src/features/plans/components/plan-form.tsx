'use client';

import { useActionState } from 'react';
import { MODULE_KEYS, MODULE_NAMES, type PlanCatalogEntry } from '@templeos/validators';
import { Alert, Button, Input, Label } from '@templeos/ui';
import { initialFormState, type FormState } from '@/lib/form-state';

interface PlanFormProps {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  plan?: PlanCatalogEntry;
  submitLabel: string;
}

export function PlanForm({ action, plan, submitLabel }: PlanFormProps) {
  const [state, formAction, pending] = useActionState(action, initialFormState);

  return (
    <form action={formAction} className="space-y-6">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state.message ? <Alert tone="success">{state.message}</Alert> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        {plan ? null : (
          <div className="space-y-2">
            <Label htmlFor="key">Key</Label>
            <Input
              id="key"
              name="key"
              required
              minLength={2}
              maxLength={40}
              pattern="[a-z0-9-]+"
              placeholder="e.g. growth-plus"
            />
            <p className="text-xs text-muted-foreground">
              Lowercase letters, numbers, hyphens only. Can&apos;t be changed after creation.
            </p>
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" required maxLength={60} defaultValue={plan?.name} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="priceUsd">Price (USD/month)</Label>
          <Input
            id="priceUsd"
            name="priceUsd"
            type="number"
            min={0}
            placeholder="Leave blank if never purchased directly (e.g. Trial)"
            defaultValue={plan?.priceUsd ?? undefined}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sortOrder">Sort order</Label>
          <Input
            id="sortOrder"
            name="sortOrder"
            type="number"
            defaultValue={plan?.sortOrder ?? 0}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <textarea
          id="description"
          name="description"
          rows={2}
          required
          maxLength={300}
          defaultValue={plan?.description}
          className="w-full rounded-md border border-border bg-background p-3 text-sm placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="features">Feature bullets (one per line)</Label>
        <textarea
          id="features"
          name="features"
          rows={5}
          defaultValue={plan?.features.join('\n')}
          placeholder={'Devotees, donations, events\nUp to 2 staff accounts'}
          className="w-full rounded-md border border-border bg-background p-3 text-sm placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
        />
      </div>

      <div className="space-y-2">
        <Label>Modules included</Label>
        <div className="flex flex-col gap-1.5">
          {MODULE_KEYS.map((m) => (
            <label key={m} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="modules"
                value={m}
                defaultChecked={plan?.modules.includes(m)}
                className="size-4 rounded border-input"
              />
              {MODULE_NAMES[m]}
            </label>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="stripePriceId">Stripe Price ID</Label>
          <Input
            id="stripePriceId"
            name="stripePriceId"
            placeholder="price_..."
            defaultValue={plan?.stripePriceId ?? undefined}
          />
        </div>
        <div className="flex flex-col justify-end gap-1.5 pb-1.5">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="isPurchasable"
              value="true"
              defaultChecked={plan?.isPurchasable}
              className="size-4 rounded border-input"
            />
            Purchasable (shows an upgrade button on the billing page)
          </label>
        </div>
      </div>

      <div className="flex flex-col gap-1.5 rounded-lg border border-border p-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="isTrialDefault"
            value="true"
            defaultChecked={plan?.isTrialDefault}
            className="size-4 rounded border-input"
          />
          This is the trial plan (what new orgs are provisioned onto)
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="isFallbackDefault"
            value="true"
            defaultChecked={plan?.isFallbackDefault}
            className="size-4 rounded border-input"
          />
          This is the fallback plan (what a lapsed/expired org drops to)
        </label>
        <p className="text-xs text-muted-foreground">
          Checking either here unchecks it on whichever plan currently holds it — exactly one plan
          can be each at a time.
        </p>
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? 'Saving…' : submitLabel}
      </Button>
    </form>
  );
}
