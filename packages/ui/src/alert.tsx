import type { HTMLAttributes } from 'react';
import { cn } from './cn';

type Tone = 'error' | 'success' | 'info';

const toneClasses: Record<Tone, string> = {
  error: 'border-red-300 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200',
  success:
    'border-green-300 bg-green-50 text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-200',
  info: 'border-border bg-muted text-foreground',
};

export interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  tone?: Tone;
}

export function Alert({ className, tone = 'info', ...props }: AlertProps) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn('rounded-md border px-4 py-3 text-sm', toneClasses[tone], className)}
      {...props}
    />
  );
}
