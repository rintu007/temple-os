'use client';

import { useActionState } from 'react';
import { Alert, Button, Input, Label, Select } from '@templeos/ui';
import { initialFormState } from '@/lib/form-state';
import { recordDonationAction } from '../actions';

interface DevoteeOption {
  id: string;
  fullName: string;
}

interface CampaignOption {
  id: string;
  title: string;
}

interface DonationFormProps {
  devotees: DevoteeOption[];
  campaigns: CampaignOption[];
  currency: string;
}

const METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'card', label: 'Card' },
  { value: 'other', label: 'Other' },
];

export function DonationForm({ devotees, campaigns, currency }: DonationFormProps) {
  const [state, formAction, pending] = useActionState(recordDonationAction, initialFormState);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="amount">Amount ({currency})</Label>
          <Input
            id="amount"
            name="amount"
            type="number"
            step="0.01"
            min="1"
            placeholder="501.00"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="method">Payment method</Label>
          <Select id="method" name="method" defaultValue="cash" required>
            {METHODS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="devoteeId">Devotee</Label>
          <Select id="devoteeId" name="devoteeId" defaultValue="">
            <option value="">— Walk-in / not listed —</option>
            {devotees.map((d) => (
              <option key={d.id} value={d.id}>
                {d.fullName}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="donorName">Donor name (if not a listed devotee)</Label>
          <Input id="donorName" name="donorName" placeholder="Name on the receipt" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="categoryName">Category</Label>
          <Input
            id="categoryName"
            name="categoryName"
            placeholder="General Donation"
            list="donation-categories"
          />
          <datalist id="donation-categories">
            <option value="General Donation" />
            <option value="Puja Sponsorship" />
            <option value="Annadanam" />
            <option value="Temple Construction" />
            <option value="Festival Fund" />
          </datalist>
        </div>
        <div className="space-y-2">
          <Label htmlFor="donatedOn">Date</Label>
          <Input id="donatedOn" name="donatedOn" type="date" defaultValue={today} />
        </div>

        {campaigns.length > 0 ? (
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="campaignId">Campaign (optional)</Label>
            <Select id="campaignId" name="campaignId" defaultValue="">
              <option value="">— Not part of a campaign —</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </Select>
          </div>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="reference">Reference (UPI/cheque no.)</Label>
          <Input id="reference" name="reference" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="note">Note</Label>
          <Input id="note" name="note" />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="email">Donor email (optional — emails a receipt)</Label>
          <Input id="email" name="email" type="email" placeholder="donor@example.com" />
        </div>
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? 'Recording…' : 'Record donation'}
      </Button>
    </form>
  );
}
