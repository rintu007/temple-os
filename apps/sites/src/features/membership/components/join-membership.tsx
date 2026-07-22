'use client';

import { useState } from 'react';
import { Alert, Button, Input, Label, Select, formatMoney } from '@templeos/ui';
import { loadRazorpayCheckout } from '@/features/donations/razorpay-types';
import { confirmJoin, createJoinOrder } from '../actions';

interface PlanOption {
  id: string;
  name: string;
  description: string | null;
  price: string;
  currency: 'INR' | 'BDT';
  durationMonths: number;
}

interface JoinMembershipProps {
  organizationId: string;
  organizationName: string;
  currency: 'INR' | 'BDT';
  plans: PlanOption[];
}

type Step = 'form' | 'processing' | 'success' | 'error';

function durationLabel(months: number): string {
  if (months === 12) return '1 year';
  if (months === 1) return '1 month';
  if (months % 12 === 0) return `${months / 12} years`;
  return `${months} months`;
}

export function JoinMembership({
  organizationId,
  organizationName,
  currency,
  plans,
}: JoinMembershipProps) {
  const [planId, setPlanId] = useState(plans[0]?.id ?? '');
  const [memberName, setMemberName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [step, setStep] = useState<Step>('form');
  const [error, setError] = useState('');
  const [receiptNumber, setReceiptNumber] = useState('');
  const [joinedPlan, setJoinedPlan] = useState('');
  const [validUntil, setValidUntil] = useState('');

  const selected = plans.find((p) => p.id === planId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setStep('processing');

    const scriptLoaded = await loadRazorpayCheckout();
    if (!scriptLoaded || !window.Razorpay) {
      setError('Could not load the payment form. Please check your connection and try again.');
      setStep('error');
      return;
    }

    const created = await createJoinOrder(organizationId, currency, {
      planId,
      memberName,
      email,
      phone,
    });
    if (!created.ok || !created.orderId || !created.amountPaise || !created.keyId) {
      setError(created.error ?? 'Could not start checkout. Please try again.');
      setStep('error');
      return;
    }

    const razorpay = new window.Razorpay({
      key: created.keyId,
      amount: created.amountPaise,
      currency: 'INR',
      name: organizationName,
      description: `Membership: ${created.planName}`,
      order_id: created.orderId,
      prefill: { name: memberName, email, contact: phone },
      theme: { color: '#ea580c' },
      handler: (response) => {
        void (async () => {
          const confirmed = await confirmJoin(organizationId, organizationName, {
            providerOrderId: response.razorpay_order_id,
            providerPaymentId: response.razorpay_payment_id,
            signature: response.razorpay_signature,
            email,
          });
          if (!confirmed.ok || !confirmed.receiptNumber) {
            setError(
              confirmed.error ??
                'Payment succeeded but membership could not be confirmed — contact the temple with your payment ID.',
            );
            setStep('error');
            return;
          }
          setReceiptNumber(confirmed.receiptNumber);
          setJoinedPlan(confirmed.planName ?? created.planName ?? '');
          setValidUntil(confirmed.expiresOn ?? '');
          setStep('success');
        })();
      },
      modal: { ondismiss: () => setStep('form') },
    });
    razorpay.on('payment.failed', (response) => {
      setError(response.error.description || 'Payment failed. Please try again.');
      setStep('error');
    });
    razorpay.open();
  }

  if (step === 'success') {
    return (
      <Alert tone="success">
        <p className="font-medium">Welcome — you are now a {joinedPlan}!</p>
        <p className="mt-1">
          Receipt <strong>{receiptNumber}</strong> has been {email ? 'emailed to you' : 'generated'}.
          {validUntil
            ? ` Your membership is valid until ${new Date(`${validUntil}T12:00:00`).toLocaleDateString(
                'en-IN',
                { day: 'numeric', month: 'long', year: 'numeric' },
              )}.`
            : ''}
        </p>
      </Alert>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {step === 'error' && error ? <Alert tone="error">{error}</Alert> : null}

      <div className="space-y-2">
        <Label htmlFor="plan">Choose a plan</Label>
        <Select id="plan" value={planId} onChange={(e) => setPlanId(e.target.value)} required>
          {plans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} — {formatMoney(p.price, p.currency)} / {durationLabel(p.durationMonths)}
            </option>
          ))}
        </Select>
        {selected?.description ? (
          <p className="text-sm text-muted-foreground">{selected.description}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="member-name">Your name</Label>
        <Input
          id="member-name"
          value={memberName}
          onChange={(e) => setMemberName(e.target.value)}
          required
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="member-email">Email (for your receipt)</Label>
          <Input
            id="member-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="member-phone">Phone</Label>
          <Input
            id="member-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
      </div>

      <Button type="submit" className="w-full" disabled={step === 'processing'}>
        {step === 'processing'
          ? 'Opening checkout…'
          : selected
            ? `Join for ${formatMoney(selected.price, selected.currency)}`
            : 'Join'}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        Secure checkout powered by Razorpay.
      </p>
    </form>
  );
}
