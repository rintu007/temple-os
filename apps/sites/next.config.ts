import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@templeos/core', '@templeos/db', '@templeos/ui', '@templeos/validators'],
};

export default nextConfig;
