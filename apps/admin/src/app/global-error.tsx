'use client';

import { useEffect } from 'react';

/**
 * Catches errors thrown by the root layout itself (outside error.tsx's reach),
 * so it must render its own <html>/<body> — the root layout is gone by the
 * time this renders.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="flex min-h-dvh items-center justify-center p-8 font-sans antialiased">
        <div className="max-w-sm text-center">
          <p className="text-sm font-semibold text-red-600">Something went wrong</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">TempleOS hit a snag</h1>
          <p className="mt-2 text-sm text-neutral-500">
            Try reloading the page. If this keeps happening, contact support.
          </p>
          <button
            type="button"
            onClick={reset}
            className="mt-6 inline-flex h-9.5 items-center justify-center rounded-lg bg-neutral-900 px-4 text-sm font-medium text-white transition-colors hover:bg-neutral-800"
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
