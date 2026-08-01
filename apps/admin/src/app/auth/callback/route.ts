import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { profileService } from '@/lib/services';

/** PKCE callback: email confirmation / OAuth / email-change confirmation land here with ?code= */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // A signup confirmation lands here too, before any users row exists —
      // syncEmail is a no-op update in that case (0 rows matched), so it's safe either way.
      if (data.user?.email) {
        await profileService()
          .syncEmail(data.user.id, data.user.email)
          .catch(() => {});
      }
      return NextResponse.redirect(`${origin}${next.startsWith('/') ? next : '/'}`);
    }
  }
  return NextResponse.redirect(`${origin}/login?error=confirmation`);
}
