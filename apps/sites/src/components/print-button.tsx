'use client';

import { Button } from '@templeos/ui';

export function PrintButton({ label = 'Print / Save as PDF' }: { label?: string }) {
  return (
    <Button type="button" onClick={() => window.print()} className="print:hidden">
      {label}
    </Button>
  );
}
