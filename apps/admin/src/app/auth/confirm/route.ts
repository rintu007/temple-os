import { NextResponse } from 'next/server';
import type { EmailOtpType } from '@templeos/auth';
import { createClient } from '@/lib/supabase/server';

/** token_hash flow: used when the Supabase email template links directly with a token hash. */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const next = searchParams.get('next') ?? '/';

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      return NextResponse.redirect(`${origin}${next.startsWith('/') ? next : '/'}`);
    }
  }
  return NextResponse.redirect(`${origin}/login?error=confirmation`);
}
