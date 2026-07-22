import type { Metadata } from 'next';
import Link from 'next/link';
import { SignupForm } from '@/features/auth/components/signup-form';

export const metadata: Metadata = { title: 'Create account' };

interface SignupPageProps {
  searchParams: Promise<{ next?: string }>;
}

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const { next } = await searchParams;
  return (
    <div className="rounded-2xl border border-border bg-card p-8 shadow-raised">
      <h1 className="text-xl font-semibold tracking-tight">Create your account</h1>
      <p className="mb-6 mt-1 text-sm text-muted-foreground">
        Set up your temple on TempleOS in minutes.
      </p>
      <SignupForm next={next} />
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link
          href={next ? `/login?next=${encodeURIComponent(next)}` : '/login'}
          className="font-medium text-primary hover:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
