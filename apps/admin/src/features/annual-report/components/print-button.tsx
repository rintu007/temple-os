'use client';

import { Button } from '@templeos/ui';

export function PrintButton() {
  return (
    <Button variant="outline" size="sm" type="button" onClick={() => window.print()}>
      Print / Save as PDF
    </Button>
  );
}
