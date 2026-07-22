import type { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-muted/30 p-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_60%_at_50%_0%,hsl(var(--primary)/0.1),transparent)]"
      />
      <div className="relative w-full max-w-sm">
        <div className="mb-6 text-center">
          <span className="text-xl font-semibold tracking-tight">
            Temple<span className="text-primary">OS</span>
          </span>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Temple management for the modern age
          </p>
        </div>
        {children}
      </div>
    </main>
  );
}
