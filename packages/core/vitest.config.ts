import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

// Load the monorepo root .env so live-db tests can reach Supabase locally.
for (const candidate of ['.env', '../.env', '../../.env']) {
  const path = resolve(process.cwd(), candidate);
  if (existsSync(path)) {
    process.loadEnvFile(path);
    break;
  }
}

export default defineConfig({
  test: {
    environment: 'node',
    // Live-db tests share one connection budget; keep them sequential.
    fileParallelism: false,
    // Tests run against the real Supabase pooler — multi-second latency
    // spikes and occasional 30s+ stalls are normal from a home network.
    testTimeout: 90_000,
    hookTimeout: 90_000,
  },
});
