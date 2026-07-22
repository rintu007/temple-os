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
};

export default nextConfig;
