import type { Metadata } from 'next';
import Link from 'next/link';
import { createVendorAction } from '@/features/vendors/actions';
import { VendorForm } from '@/features/vendors/components/vendor-form';

export const metadata: Metadata = { title: 'Add vendor' };

export default function NewVendorPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/vendors" className="text-sm text-muted-foreground hover:text-foreground">
          ← Vendors
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Add vendor</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Register a supplier. You can add their bills once they&apos;re on the list.
        </p>
      </div>

      <section className="rounded-xl border border-border bg-card p-6 shadow-card">
        <VendorForm action={createVendorAction} submitLabel="Add vendor" />
      </section>
    </div>
  );
}
