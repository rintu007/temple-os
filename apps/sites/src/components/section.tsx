import type { ReactNode } from 'react';
import { cn } from '@templeos/ui';

interface SectionProps {
  id?: string;
  eyebrow?: string;
  title?: string;
  align?: 'center' | 'left';
  tone?: 'plain' | 'muted';
  children: ReactNode;
  className?: string;
}

/**
 * Consistent section rhythm for the tenant homepage — one vertical padding
 * scale and one heading treatment, so sections read as one system instead of
 * each picking its own margin/heading style.
 */
export function Section({ id, eyebrow, title, align = 'center', tone = 'plain', children, className }: SectionProps) {
  return (
    <section
      id={id}
      className={cn('scroll-mt-24 py-14 sm:py-16', tone === 'muted' && 'bg-muted/30', className)}
    >
      <div className="mx-auto max-w-5xl px-6">
        {eyebrow || title ? (
          <header className={cn('mb-10', align === 'center' ? 'text-center' : 'text-left')}>
            {eyebrow ? (
              <div className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">{eyebrow}</div>
            ) : null}
            {title ? (
              <h2 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
                {title}
              </h2>
            ) : null}
          </header>
        ) : null}
        {children}
      </div>
    </section>
  );
}
