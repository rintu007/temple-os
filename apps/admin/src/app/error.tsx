'use client';

import { useEffect } from 'react';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-dvh items-center justify-center p-8">
      <div className="max-w-sm text-center">
        <p className="text-sm font-semibold text-destructive">Something went wrong</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          We hit a snag loading this page
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Nothing was lost — try again, or head back to the dashboard.
          {error.digest ? (
            <span className="mt-1 block font-mono text-xs">Ref: {error.digest}</span>
          ) : null}
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-9.5 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-card transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex h-9.5 items-center justify-center rounded-lg border border-input bg-card px-4 text-sm font-medium shadow-card transition-colors hover:bg-muted/60"
          >
            Back to dashboard
          </a>
        </div>
      </div>
    </main>
  );
}
