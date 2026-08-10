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
    '@templeos/auth',
    '@templeos/core',
    '@templeos/db',
    '@templeos/email',
    '@templeos/ui',
    '@templeos/validators',
  ],
  experimental: {
    serverActions: {
      // Gallery image uploads go through a server action (5 MB image cap + form overhead)
      bodySizeLimit: '8mb',
    },
  },
  // No Content-Security-Policy yet: this app has no third-party checkout
  // scripts, but a CSP shared with apps/sites would need to be verified
  // against the live Razorpay checkout flow first — see apps/sites/next.config.ts.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        ],
      },
    ];
  },
};

export default nextConfig;
