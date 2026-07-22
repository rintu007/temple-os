import type { Metadata } from 'next';
import Link from 'next/link';
import { ImportForm } from '@/features/devotees/components/import-form';

export const metadata: Metadata = { title: 'Import devotees' };

export default function ImportDevoteesPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/devotees" className="text-sm text-muted-foreground hover:text-foreground">
          ← Devotees
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Import devotees</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Bring in your existing register from Excel or Google Sheets (export as CSV first). Up to
          500 rows per import; rows matching an existing phone or email are skipped.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card shadow-card p-6">
        <ImportForm />
      </div>

      <div className="rounded-xl border border-border bg-card shadow-card p-6 text-sm">
        <h2 className="font-medium">Supported columns</h2>
        <p className="mt-1 text-muted-foreground">
          Only <strong>name</strong> is required. Header names are flexible — these all work:
        </p>
        <ul className="mt-3 grid gap-1.5 text-muted-foreground sm:grid-cols-2">
          <li>• name / full name</li>
          <li>• phone / mobile / contact</li>
          <li>• email</li>
          <li>• family / household</li>
          <li>• gender / sex (M, F, other)</li>
          <li>• dob (15/08/1975 or 1975-08-15)</li>
          <li>• address</li>
          <li>• city, state, pincode</li>
          <li>• notes / remarks</li>
        </ul>
      </div>
    </div>
  );
}
