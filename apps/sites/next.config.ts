import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { NextConfig } from 'next';

// Monorepo root .env (Next only auto-loads env files from the app directory).
// Existing environment variables (e.g. on Vercel) are never overridden.
const rootEnv = resolve(process.cwd(), '../../.env');
if (existsSync(rootEnv)) {
  process.loadEnvFile(rootEnv);
}

const nextConfig: NextConfig = {
  transpilePackages: [
    '@templeos/core',
    '@templeos/db',
    '@templeos/email',
    '@templeos/ui',
    '@templeos/validators',
  ],
  // Content-Security-Policy is deliberately NOT set here yet: this app
  // dynamically loads Razorpay's checkout.js and opens its payment iframe
  // (apps/sites/src/features/donations/razorpay-types.ts), and donation
  // intake must never break — a CSP wrong in either direction (too loose
  // does nothing, too strict silently kills checkout with no visible error
  // besides a browser console warning) needs to be verified against a real
  // Razorpay/Stripe/SSLCommerz checkout run before enforcing. Tracked as a
  // follow-up in docs/SAAS-LAUNCH-PLAN.md.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        ],
      },
    ];
  },
};

export default nextConfig;
