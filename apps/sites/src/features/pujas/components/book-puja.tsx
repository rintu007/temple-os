'use client';

import { useState } from 'react';
import { Alert, Button, Input, Label, Select, formatMoney } from '@templeos/ui';
import { loadRazorpayCheckout } from '@/features/donations/razorpay-types';
import { confirmBooking, createBookingOrder } from '../actions';

interface PujaOption {
  id: string;
  name: string;
  description: string | null;
  price: string;
  currency: 'INR' | 'BDT';
}

interface BookPujaProps {
  organizationId: string;
  organizationName: string;
  currency: 'INR' | 'BDT';
  pujaTypes: PujaOption[];
}

type Step = 'form' | 'processing' | 'success' | 'error';

export function BookPuja({ organizationId, organizationName, currency, pujaTypes }: BookPujaProps) {
  const [pujaTypeId, setPujaTypeId] = useState(pujaTypes[0]?.id ?? '');
  const [devoteeName, setDevoteeName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [preferredDate, setPreferredDate] = useState('');
  const [step, setStep] = useState<Step>('form');
  const [error, setError] = useState('');
  const [receiptNumber, setReceiptNumber] = useState('');
  const [bookedPuja, setBookedPuja] = useState('');

  const selected = pujaTypes.find((p) => p.id === pujaTypeId);

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

    const created = await createBookingOrder(organizationId, currency, {
      pujaTypeId,
      devoteeName,
      email,
      phone,
      preferredDate,
      note: '',
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
      description: `Puja booking: ${created.pujaName}`,
      order_id: created.orderId,
      prefill: { name: devoteeName, email, contact: phone },
      theme: { color: '#ea580c' },
      handler: (response) => {
        void (async () => {
          const confirmed = await confirmBooking(organizationId, organizationName, {
            providerOrderId: response.razorpay_order_id,
            providerPaymentId: response.razorpay_payment_id,
            signature: response.razorpay_signature,
            email,
          });
          if (!confirmed.ok || !confirmed.receiptNumber) {
            setError(
              confirmed.error ??
                'Payment succeeded but the booking could not be confirmed — contact the temple with your payment ID.',
            );
            setStep('error');
            return;
          }
          setReceiptNumber(confirmed.receiptNumber);
          setBookedPuja(confirmed.pujaName ?? created.pujaName ?? '');
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
        <p className="font-medium">Your {bookedPuja} is booked!</p>
        <p className="mt-1">
          Receipt <strong>{receiptNumber}</strong> has been {email ? 'emailed to you' : 'generated'}.
          The temple will perform the puja and may contact you to confirm timing.
        </p>
      </Alert>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {step === 'error' && error ? <Alert tone="error">{error}</Alert> : null}

      <div className="space-y-2">
        <Label htmlFor="puja-type">Choose a puja</Label>
        <Select
          id="puja-type"
          value={pujaTypeId}
          onChange={(e) => setPujaTypeId(e.target.value)}
          required
        >
          {pujaTypes.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} — {formatMoney(p.price, p.currency)}
            </option>
          ))}
        </Select>
        {selected?.description ? (
          <p className="text-sm text-muted-foreground">{selected.description}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="booking-name">Your name</Label>
        <Input
          id="booking-name"
          value={devoteeName}
          onChange={(e) => setDevoteeName(e.target.value)}
          required
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="booking-email">Email (for your receipt)</Label>
          <Input
            id="booking-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="booking-phone">Phone</Label>
          <Input
            id="booking-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="booking-date">Preferred date (optional)</Label>
        <Input
          id="booking-date"
          type="date"
          value={preferredDate}
          onChange={(e) => setPreferredDate(e.target.value)}
        />
      </div>

      <Button type="submit" className="w-full" disabled={step === 'processing'}>
        {step === 'processing'
          ? 'Opening checkout…'
          : selected
            ? `Book for ${formatMoney(selected.price, selected.currency)}`
            : 'Book puja'}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        Secure checkout powered by Razorpay.
      </p>
    </form>
  );
}
