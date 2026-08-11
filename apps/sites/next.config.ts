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
  // Content-Security-Policy: allows exactly the external resources this app
  // actually loads. Verified against a real production build + a real
  // Razorpay test-mode checkout in a headless browser (not just static
  // source audit) — that run caught two Razorpay sub-origins static
  // analysis missed entirely: cdn.razorpay.com (their risk-detection
  // script, loaded only once the modal opens) and lumberjack.razorpay.com
  // (their analytics beacon). Also: checkout.razorpay.com/v1/checkout.js
  // (dynamically injected — apps/sites/src/features/donations/razorpay-types.ts)
  // and api.razorpay.com (the payment iframe), plus Supabase Storage for
  // gallery/temple images (plain <img>, not next/image — no remotePatterns
  // configured). Stripe/SSLCommerz checkout are full-page redirects, not
  // embedded scripts/iframes, so neither needs an allowance. 'unsafe-inline'
  // on script-src/style-src is a deliberate compromise, not an oversight:
  // Next.js App Router injects inline hydration scripts and small inline
  // styles without a CSP nonce wired through middleware, and building that
  // properly is a larger, riskier change than this fix warrants — the real
  // value here is restricting which THIRD-PARTY origins can load, not
  // eliminating inline-script risk entirely.
  async headers() {
    const supabaseOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
    const csp = [
      `default-src 'self'`,
      `script-src 'self' 'unsafe-inline' https://checkout.razorpay.com https://cdn.razorpay.com`,
      `style-src 'self' 'unsafe-inline'`,
      `img-src 'self' data: ${supabaseOrigin}`.trim(),
      `font-src 'self'`,
      `connect-src 'self' https://checkout.razorpay.com https://api.razorpay.com https://lumberjack.razorpay.com`,
      `frame-src https://checkout.razorpay.com https://api.razorpay.com`,
      `object-src 'none'`,
      `base-uri 'self'`,
      `frame-ancestors 'self'`,
    ].join('; ');

    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
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
