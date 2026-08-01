import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalDocument } from '@/components/legal-document';

export const metadata: Metadata = {
  title: 'Refund & Cancellation Policy — TempleOS',
  description: 'Refund and cancellation policy for TempleOS subscriptions.',
  robots: { index: false }, // draft — keep out of search until reviewed and finalized
};

export default function RefundPolicyPage() {
  return (
    <LegalDocument title="Refund &amp; Cancellation Policy" lastUpdated="[Date of legal review]">
      <p>
        This policy covers TempleOS&apos;s own subscription fees only. It does not cover donations,
        puja/seva payments, or membership fees that devotees pay to your temple through your
        temple&apos;s site — those payments go directly to your organization and are between your
        organization and the devotee; see{' '}
        <Link href="/terms">Section 5 of our Terms of Service</Link>.
      </p>

      <h2>1. Free trial</h2>
      <p>
        Every organization starts with a 14-day free trial. No payment method is required to
        start a trial, so there is nothing to refund during this period.
      </p>

      <h2>2. Subscription fees</h2>
      <p>
        Paid plans are billed monthly in advance. [Confirm final policy: TempleOS does not
        currently offer prorated refunds for unused time in a billing period once that period has
        started. Decide whether to offer a money-back guarantee window (e.g. 7 days) for a
        customer&apos;s first paid billing cycle, and state it here explicitly if so.]
      </p>

      <h2>3. Changing plans</h2>
      <p>
        You can upgrade, downgrade, or switch plans at any time from your billing page. Plan
        changes take effect immediately; we do not currently prorate or refund the difference for
        the remainder of a billing period when you downgrade mid-cycle.
      </p>

      <h2>4. Cancelling</h2>
      <p>
        You can cancel your subscription at any time from your billing page. When you cancel, your
        organization moves to the free Starter plan — your public website, devotee records,
        one-time donations, and events keep working without interruption.
      </p>

      <h2>5. Failed payments</h2>
      <p>
        If a subscription payment fails, your account is marked past due and we will attempt to
        notify you. [Confirm and state the grace period before an organization with a past-due
        subscription is moved down to the Starter plan or otherwise restricted.] Core operations —
        your public site and its ability to receive donations — are never affected by a billing
        issue.
      </p>

      <h2>6. Chargebacks</h2>
      <p>
        If you believe you were charged in error, please contact us at [support email address]
        before initiating a chargeback with your bank or card issuer — we can usually resolve
        billing issues faster directly.
      </p>

      <h2>7. Contact</h2>
      <p>
        For a refund request or any billing question, contact [support email address].
      </p>
    </LegalDocument>
  );
}
