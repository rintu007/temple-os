import type { HTMLAttributes } from 'react';
import { cn } from './cn';

type Tone = 'error' | 'success' | 'info';

const toneClasses: Record<Tone, string> = {
  error: 'border-destructive/25 bg-destructive/8 text-destructive dark:bg-destructive/12',
  success: 'border-success/25 bg-success/8 text-success dark:bg-success/12',
  info: 'border-border bg-muted/60 text-foreground',
};

export interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  tone?: Tone;
}

export function Alert({ className, tone = 'info', ...props }: AlertProps) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn('rounded-lg border px-4 py-3 text-sm font-medium', toneClasses[tone], className)}
      {...props}
    />
  );
}
