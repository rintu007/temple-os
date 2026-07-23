'use client';

import { useState } from 'react';
import { Alert, Button, Input, Label } from '@templeos/ui';
import { getDict, type Locale } from '@/i18n/dictionaries';
import { confirmDonationOrder, createDonationOrder } from '../actions';
import { loadRazorpayCheckout } from '../razorpay-types';

interface DonateFormProps {
  locale: Locale;
  organizationId: string;
  organizationName: string;
  currency: 'INR' | 'BDT';
}

const SUGGESTED_AMOUNTS = [101, 501, 1101, 2101];

type Step = 'form' | 'processing' | 'success' | 'error';

export function DonateForm({ locale, organizationId, organizationName, currency }: DonateFormProps) {
  const t = getDict(locale);
  const [amount, setAmount] = useState('501');
  const [donorName, setDonorName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [step, setStep] = useState<Step>('form');
  const [error, setError] = useState('');
  const [receiptNumber, setReceiptNumber] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setStep('processing');

    // BDT: SSLCommerz hosted checkout — the whole page redirects to the
    // gateway and returns via /donation-complete. No script to load.
    if (currency === 'BDT') {
      const created = await createDonationOrder(organizationId, currency, {
        amount,
        donorName,
        email,
        phone,
        categoryName: '',
      });
      if (!created.ok || !created.redirectUrl) {
        setError(created.error ?? 'Could not start checkout. Please try again.');
        setStep('error');
        return;
      }
      window.location.assign(created.redirectUrl);
      return;
    }

    const scriptLoaded = await loadRazorpayCheckout();
    if (!scriptLoaded || !window.Razorpay) {
      setError('Could not load the payment form. Please check your connection and try again.');
      setStep('error');
      return;
    }

    const created = await createDonationOrder(organizationId, currency, {
      amount,
      donorName,
      email,
      phone,
      categoryName: '',
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
      description: 'Donation',
      order_id: created.orderId,
      prefill: { name: donorName, email, contact: phone },
      theme: { color: '#ea580c' },
      handler: (response) => {
        void (async () => {
          const confirmed = await confirmDonationOrder(organizationId, organizationName, {
            providerOrderId: response.razorpay_order_id,
            providerPaymentId: response.razorpay_payment_id,
            signature: response.razorpay_signature,
            email,
          });
          if (!confirmed.ok || !confirmed.receiptNumber) {
            setError(
              confirmed.error ??
                'Payment succeeded but the receipt could not be confirmed — contact the temple with your payment ID.',
            );
            setStep('error');
            return;
          }
          setReceiptNumber(confirmed.receiptNumber);
          setStep('success');
        })();
      },
      modal: {
        ondismiss: () => setStep('form'),
      },
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
        <p className="font-medium">Thank you, {donorName || 'friend'}!</p>
        <p className="mt-1">
          Your donation was received. Receipt <strong>{receiptNumber}</strong> has been emailed to
          you{email ? '' : ' — enter an email next time to get a receipt automatically'}.
        </p>
      </Alert>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {step === 'error' && error ? <Alert tone="error">{error}</Alert> : null}

      <div className="space-y-2">
        <Label htmlFor="donate-amount">{t.forms.amount(currency)}</Label>
        <div className="mb-2 flex flex-wrap gap-2">
          {SUGGESTED_AMOUNTS.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => setAmount(String(a))}
              className={`rounded-md border px-3 py-1 text-sm ${
                amount === String(a)
                  ? 'border-primary bg-primary/10 font-medium text-primary'
                  : 'border-border text-muted-foreground hover:bg-muted'
              }`}
            >
              {a}
            </button>
          ))}
        </div>
        <Input
          id="donate-amount"
          type="number"
          min="1"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="donate-name">{t.forms.yourName}</Label>
        <Input
          id="donate-name"
          value={donorName}
          onChange={(e) => setDonorName(e.target.value)}
          required
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="donate-email">{t.forms.emailForReceipt}</Label>
          <Input
            id="donate-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="donate-phone">{t.forms.phone}</Label>
          <Input id="donate-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
      </div>

      <Button type="submit" className="w-full" disabled={step === 'processing'}>
        {step === 'processing'
          ? t.forms.processing
          : t.forms.donateFor(`${currency === 'INR' ? '₹' : '৳'}${amount || '0'}`)}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        {t.forms.poweredBy(currency === 'INR' ? 'Razorpay' : 'SSLCommerz')}
      </p>
    </form>
  );
}
