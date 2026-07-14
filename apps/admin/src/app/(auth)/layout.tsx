import type { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted/40 p-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <span className="text-lg font-semibold tracking-tight">
            Temple<span className="text-primary">OS</span>
          </span>
        </div>
        {children}
      </div>
    </main>
  );
}
