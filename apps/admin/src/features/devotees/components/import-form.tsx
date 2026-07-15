'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { Alert, Button, Label } from '@templeos/ui';
import { importDevoteesAction, type ImportFormState } from '../import-actions';

const initialState: ImportFormState = {};

export function ImportForm() {
  const [state, formAction, pending] = useActionState(importDevoteesAction, initialState);
  const hasResult = state.imported !== undefined;

  return (
    <div className="space-y-6">
      <form action={formAction} className="space-y-4">
        {state.error ? <Alert tone="error">{state.error}</Alert> : null}

        <div className="space-y-2">
          <Label htmlFor="file">CSV file</Label>
          <input
            id="file"
            name="file"
            type="file"
            accept=".csv,text/csv"
            className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border file:border-border file:bg-muted file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground hover:file:bg-muted/70"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="csv">…or paste CSV data</Label>
          <textarea
            id="csv"
            name="csv"
            rows={8}
            placeholder={'name,phone,email,family,city\nAnita Roy,9876543210,anita@example.com,Roy Family,Kolkata'}
            className="w-full rounded-md border border-border bg-background p-3 font-mono text-xs placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
          />
        </div>

        <Button type="submit" disabled={pending}>
          {pending ? 'Importing…' : 'Import devotees'}
        </Button>
      </form>

      {hasResult ? (
        <div className="space-y-3">
          <Alert tone={state.imported && state.imported > 0 ? 'success' : 'info'}>
            Imported <strong>{state.imported}</strong> devotee(s)
            {state.duplicates ? (
              <>
                {' '}
                · skipped <strong>{state.duplicates}</strong> duplicate(s) (same phone or email)
              </>
            ) : null}
            {state.rowErrors?.length ? (
              <>
                {' '}
                · <strong>{state.rowErrors.length}</strong> row(s) had problems
              </>
            ) : null}
          </Alert>

          {state.rowErrors && state.rowErrors.length > 0 ? (
            <div className="rounded-md border border-border">
              <div className="border-b border-border px-4 py-2 text-sm font-medium">
                Rows that were not imported
              </div>
              <ul className="divide-y divide-border text-sm">
                {state.rowErrors.map((e) => (
                  <li key={e.line} className="flex gap-4 px-4 py-2">
                    <span className="w-16 shrink-0 text-muted-foreground">Line {e.line}</span>
                    <span>{e.message}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {state.imported && state.imported > 0 ? (
            <Link href="/devotees" className="inline-block text-sm font-medium text-primary hover:underline">
              View the directory →
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
