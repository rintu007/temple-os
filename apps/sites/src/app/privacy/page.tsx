import type { Metadata } from 'next';
import { LegalDocument } from '@/components/legal-document';

export const metadata: Metadata = {
  title: 'Privacy Policy — TempleOS',
  description: 'Privacy Policy for the TempleOS platform.',
  robots: { index: false }, // draft — keep out of search until reviewed and finalized
};

export default function PrivacyPage() {
  return (
    <LegalDocument title="Privacy Policy" lastUpdated="[Date of legal review]">
      <p>
        This policy explains how [Company legal name] (&quot;TempleOS&quot;, &quot;we&quot;)
        handles personal data. It covers two different relationships, described separately below
        because our role is different in each:
      </p>
      <ul>
        <li>
          <strong>Your organization&apos;s staff accounts</strong> (owners, admins, and other
          staff who sign in to the TempleOS admin portal) — here, TempleOS is the data controller.
        </li>
        <li>
          <strong>Devotee, donor, member, and volunteer data</strong> that your organization
          collects through its public site, donation forms, or booking flows — here, your
          organization is the data controller and TempleOS is a data processor acting on its
          instructions.
        </li>
      </ul>

      <h2>1. Staff account data we collect</h2>
      <p>
        When someone creates or joins an organization on TempleOS, we collect their name, email
        address, and role. We also record activity relevant to security and support, such as
        sign-in times and an audit trail of significant actions taken in your organization&apos;s
        account.
      </p>

      <h2>2. How we use staff account data</h2>
      <ul>
        <li>To provide, maintain, and secure the Service;</li>
        <li>To send transactional email (invitations, password resets, billing notices);</li>
        <li>To provide support when you contact us;</li>
        <li>To detect and prevent abuse or unauthorized access.</li>
      </ul>
      <p>
        We do not sell staff account data, and we do not use it for third-party advertising.
      </p>

      <h2>3. Devotee, donor, and member data</h2>
      <p>
        Your organization decides what data to collect from its devotees, donors, members, and
        volunteers (for example: name, contact details, donation history, puja bookings,
        membership status) and what it uses that data for. TempleOS stores and processes this data
        only to operate the Service on your organization&apos;s behalf, and does not use it for
        any purpose of our own, including advertising. If someone wants to access, correct, or
        delete their personal data held by a temple, they should contact that temple directly;
        TempleOS supports organizations in fulfilling such requests through the Service.
      </p>

      <h2>4. Payment data</h2>
      <p>
        We do not store full payment card numbers. Your organization&apos;s subscription payments
        are handled by Stripe; devotee donation payments are handled by Razorpay (India) or
        SSLCommerz (Bangladesh), depending on your organization&apos;s currency. Each processor has
        its own privacy policy governing the payment data it collects directly.
      </p>

      <h2>5. Subprocessors</h2>
      <p>We rely on the following subprocessors to operate the Service:</p>
      <ul>
        <li><strong>Supabase</strong> — database hosting and authentication (data hosted on AWS, ap-south-1 / Mumbai region);</li>
        <li><strong>Vercel</strong> — application hosting;</li>
        <li><strong>Stripe</strong> — TempleOS&apos;s own subscription billing;</li>
        <li><strong>Razorpay</strong> — donation payment processing for India;</li>
        <li><strong>SSLCommerz</strong> — donation payment processing for Bangladesh;</li>
        <li><strong>Resend</strong> — transactional email delivery;</li>
        <li><strong>Meta (WhatsApp Business Platform)</strong> — only if your organization enables WhatsApp broadcasts to devotees.</li>
      </ul>
      <p>[Confirm this list is complete and current before publishing, and add a change-notification process for subprocessor updates.]</p>

      <h2>6. Data isolation and security</h2>
      <p>
        Every organization&apos;s data is isolated at the database level using row-level security
        policies, in addition to application-level access controls — one organization cannot query
        another organization&apos;s records even through a bug in application code. Data is
        encrypted in transit (HTTPS/TLS). Access to production data is limited to what is
        necessary to operate and support the Service.
      </p>

      <h2>7. Data retention</h2>
      <p>
        We retain staff account and organization data for as long as your account is active, and
        for a limited period after closure to allow reactivation and meet legal obligations.
        Activity/audit logs are currently retained without a fixed expiry; a formal retention
        schedule for audit logs is in progress. [Finalize and publish a specific retention
        schedule before this policy is treated as final.]
      </p>

      <h2>8. International data transfers</h2>
      <p>
        Our infrastructure is currently hosted in the AWS ap-south-1 (Mumbai, India) region.
        Depending on where your organization and its devotees are located, using the Service may
        involve transferring personal data to India. [Add region-specific transfer mechanisms —
        e.g. GDPR standard contractual clauses — if the organization serves EU/UK-based temples or
        devotees.]
      </p>

      <h2>9. Your rights</h2>
      <p>
        Depending on where you are located, you may have rights to access, correct, export, or
        delete your personal data, and to object to certain processing. Staff account holders can
        exercise these rights by contacting us at [support email address]. [Add jurisdiction-
        specific detail — e.g. India&apos;s Digital Personal Data Protection Act, EU/UK GDPR — once
        the organization&apos;s target markets and legal counsel are confirmed.]
      </p>

      <h2>10. Children&apos;s privacy</h2>
      <p>
        The Service is intended for use by adults administering an organization&apos;s account. We
        do not knowingly collect personal data directly from children through the admin portal.
      </p>

      <h2>11. Changes to this policy</h2>
      <p>
        We may update this policy from time to time. Material changes will be announced by email
        to account owners or through the Service before taking effect.
      </p>

      <h2>12. Contact</h2>
      <p>Questions about this policy can be sent to [support email address].</p>
    </LegalDocument>
  );
}
