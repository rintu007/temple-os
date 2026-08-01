import type { ReactNode } from 'react';

interface LegalDocumentProps {
  title: string;
  lastUpdated: string;
  children: ReactNode;
}

/**
 * Shared reading layout for the Terms/Privacy/Refund pages. These are drafts
 * awaiting legal review (see the banner below) — keep that banner intact
 * whenever these pages are edited, and remove it only once counsel has
 * actually signed off and the bracketed placeholders are filled in.
 */
export function LegalDocument({ title, lastUpdated, children }: LegalDocumentProps) {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 sm:py-20">
      <div className="rounded-xl border border-warning/40 bg-warning/10 px-5 py-4 text-sm">
        <p className="font-semibold text-warning-foreground">Draft — pending legal review</p>
        <p className="mt-1 text-warning-foreground/90">
          This document is a first-pass template, not yet reviewed by counsel and not yet in
          effect. Bracketed fields like [Company legal name] are placeholders. Don&apos;t rely on
          this as a finished legal document.
        </p>
      </div>

      <h1 className="mt-8 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
        {title}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated: {lastUpdated}</p>

      <div
        className="mt-10 space-y-4 text-sm leading-relaxed text-foreground/90
          [&_h2]:mt-10 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-foreground [&_h2]:first:mt-0
          [&_p]:mt-3
          [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5
          [&_li]:pl-1
          [&_strong]:font-semibold [&_strong]:text-foreground
          [&_a]:font-medium [&_a]:text-primary [&_a]:hover:underline"
      >
        {children}
      </div>
    </main>
  );
}
