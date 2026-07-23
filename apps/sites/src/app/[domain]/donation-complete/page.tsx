import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { resolveSite } from '@/lib/services';

interface DonationCompleteProps {
  params: Promise<{ domain: string }>;
  searchParams: Promise<{ status?: string; receipt?: string }>;
}

export const metadata: Metadata = { title: 'Donation', robots: { index: false } };

export default async function DonationCompletePage({ params, searchParams }: DonationCompleteProps) {
  const { domain } = await params;
  const { status, receipt } = await searchParams;
  const site = await resolveSite(domain);
  if (!site) notFound();

  const success = status === 'ok' && receipt;

  return (
    <main className="mx-auto max-w-xl px-6 py-24 text-center">
      {success ? (
        <>
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-success/10 text-3xl">
            🙏
          </div>
          <h1 className="mt-6 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight">
            Thank you for your donation
          </h1>
          <p className="mt-3 text-muted-foreground">
            Your gift to {site.name} was received. Your receipt number is{' '}
            <strong className="text-foreground">{receipt}</strong>
            {' — '}a copy has been emailed to you if you provided an address.
          </p>
        </>
      ) : (
        <>
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-destructive/10 text-3xl">
            !
          </div>
          <h1 className="mt-6 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight">
            {status === 'cancelled' ? 'Payment cancelled' : 'Payment not completed'}
          </h1>
          <p className="mt-3 text-muted-foreground">
            {status === 'cancelled'
              ? 'You cancelled the payment — nothing was charged.'
              : 'The payment could not be completed. No money has been recorded. Please try again.'}
          </p>
        </>
      )}
      <Link
        href="/#donate"
        className="mt-8 inline-flex rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-card transition-colors hover:bg-primary/90"
      >
        {success ? 'Make another donation' : 'Try again'}
      </Link>
    </main>
  );
}
