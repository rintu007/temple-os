import type { ReactNode } from 'react';
import { cn } from './cn';

export interface StatCardProps {
  label: string;
  value: ReactNode;
  /** Small line under the value — counts, deltas, context. */
  hint?: ReactNode;
  icon?: ReactNode;
  className?: string;
}

export function StatCard({ label, value, hint, icon, className }: StatCardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-border bg-card p-5 shadow-card',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        {icon ? (
          <span className="flex size-8 items-center justify-center rounded-lg bg-accent text-accent-foreground [&>svg]:size-4">
            {icon}
          </span>
        ) : null}
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">{value}</div>
      {hint ? <div className="mt-1 text-sm text-muted-foreground">{hint}</div> : null}
    </div>
  );
}
