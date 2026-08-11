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
  // Content-Security-Policy: no third-party checkout scripts here (unlike
  // apps/sites), so this is stricter — only Supabase Storage for the
  // website/gallery admin page's <img> tags needs an allowance.
  // 'unsafe-inline' on script-src/style-src: same deliberate compromise as
  // apps/sites/next.config.ts (no CSP-nonce wiring through middleware yet).
  async headers() {
    const supabaseOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
    const csp = [
      `default-src 'self'`,
      `script-src 'self' 'unsafe-inline'`,
      `style-src 'self' 'unsafe-inline'`,
      `img-src 'self' data: ${supabaseOrigin}`.trim(),
      `font-src 'self'`,
      `connect-src 'self'`,
      `object-src 'none'`,
      `base-uri 'self'`,
      `frame-ancestors 'none'`,
    ].join('; ');

    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
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
