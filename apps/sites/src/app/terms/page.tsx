import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalDocument } from '@/components/legal-document';

export const metadata: Metadata = {
  title: 'Terms of Service — TempleOS',
  description: 'Terms of Service for the TempleOS platform.',
  robots: { index: false }, // draft — keep out of search until reviewed and finalized
};

export default function TermsPage() {
  return (
    <LegalDocument title="Terms of Service" lastUpdated="[Date of legal review]">
      <p>
        These Terms of Service (&quot;Terms&quot;) govern access to and use of TempleOS (the
        &quot;Service&quot;), operated by [Company legal name] (&quot;TempleOS&quot;,
        &quot;we&quot;, &quot;us&quot;). By creating an account or otherwise using the Service,
        the organization creating that account (&quot;you&quot;, &quot;your organization&quot;)
        agrees to these Terms.
      </p>

      <h2>1. The Service</h2>
      <p>
        TempleOS is a software platform for temples and similar religious organizations
        (&quot;temples&quot;). It provides a public website, donation collection tools, puja and
        seva booking, membership management, volunteer coordination, and fund accounting,
        depending on your plan.
      </p>

      <h2>2. Accounts</h2>
      <p>
        The person who creates your organization&apos;s account is its initial owner. Owners and
        admins can invite additional staff, subject to the seat limit of your current plan. You
        are responsible for the accuracy of information you provide and for activity under your
        organization&apos;s account, including actions taken by staff you invite.
      </p>

      <h2>3. Trial and plans</h2>
      <p>
        New organizations start on a 14-day trial with no card required. Trial access includes a
        limited set of features; some capabilities (currently full fund accounting) are reserved
        for paid plans. When the trial ends without an upgrade, your organization moves to the
        free Starter plan — your public website, devotee records, one-time donations, and events
        continue to work.
      </p>
      <p>
        Available plans, their prices, and the features included in each may change over time.
        Current pricing is published at <Link href="/pricing">/pricing</Link>.
      </p>

      <h2>4. Fees and billing</h2>
      <p>
        Paid plans are billed monthly in advance, in U.S. dollars, through our payment processor
        (Stripe). By subscribing to a paid plan, you authorize us to charge your payment method on
        a recurring basis until you cancel. Prices may change; we will give notice before a change
        takes effect on your account. See our{' '}
        <Link href="/refund-policy">Refund &amp; Cancellation Policy</Link> for how billing changes
        and cancellations are handled.
      </p>

      <h2>5. Donation payments are not TempleOS transactions</h2>
      <p>
        When a devotee makes a donation, pays for a puja booking, or pays a membership fee through
        your temple&apos;s site, that payment is processed by a third-party payment processor
        (currently Razorpay for India, SSLCommerz for Bangladesh) and settles to your
        organization&apos;s own account with that processor. TempleOS facilitates this flow but is
        not a party to the transaction between the devotee and your organization, does not hold
        devotee funds, and is not responsible for payment processor settlement, KYC, or dispute
        handling — those are governed by your agreement with the payment processor directly.
      </p>

      <h2>6. Devotee and donor data</h2>
      <p>
        Data your organization collects about its devotees, donors, volunteers, and members
        through the Service belongs to your organization. As between you and TempleOS, your
        organization is the data controller for that data and TempleOS acts as a data processor,
        acting only on your organization&apos;s instructions as expressed through your use of the
        Service. See our <Link href="/privacy">Privacy Policy</Link> for details.
      </p>

      <h2>7. Acceptable use</h2>
      <p>You agree not to use the Service to:</p>
      <ul>
        <li>Violate any applicable law or the rights of any third party;</li>
        <li>Collect or process personal data without a lawful basis or without informing the people concerned, where required;</li>
        <li>Interfere with or disrupt the integrity or performance of the Service;</li>
        <li>Attempt to access another organization&apos;s data without authorization;</li>
        <li>Use the Service to send unsolicited bulk communications.</li>
      </ul>

      <h2>8. Suspension and termination</h2>
      <p>
        You may stop using the Service and cancel your subscription at any time from your billing
        page. We may suspend or terminate access to the Service if: your account has an
        outstanding payment past due, you violate these Terms, or we reasonably believe continued
        access poses a security or legal risk. Where reasonably possible, we will provide notice
        before suspension.
      </p>

      <h2>9. Service availability</h2>
      <p>
        The Service is provided on an &quot;as is&quot; and &quot;as available&quot; basis. We do
        not currently offer a service-level agreement or uptime guarantee. We aim to communicate
        planned maintenance and material incidents in advance where practical.
      </p>

      <h2>10. Limitation of liability</h2>
      <p>
        To the maximum extent permitted by law, TempleOS and its officers, employees, and agents
        will not be liable for any indirect, incidental, special, consequential, or punitive
        damages, or any loss of data, revenue, or goodwill, arising from your use of the Service.
        Our total liability for any claim arising out of these Terms is limited to the amount you
        paid us in the twelve months preceding the claim.
      </p>

      <h2>11. Intellectual property</h2>
      <p>
        TempleOS and its licensors retain all rights in the Service&apos;s software, design, and
        branding. Your organization retains all rights in the content, media, and data it uploads
        or collects through the Service.
      </p>

      <h2>12. Changes to these Terms</h2>
      <p>
        We may update these Terms from time to time. If we make material changes, we will notify
        account owners by email or through the Service before the change takes effect.
      </p>

      <h2>13. Governing law</h2>
      <p>
        These Terms are governed by the laws of [governing law jurisdiction], without regard to
        its conflict-of-law principles. Disputes will be resolved in the courts of
        [dispute resolution venue].
      </p>

      <h2>14. Contact</h2>
      <p>Questions about these Terms can be sent to [support email address].</p>
    </LegalDocument>
  );
}
