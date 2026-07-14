import { createServerClient, type CookieMethodsServer } from '@supabase/ssr';

export interface SupabaseEnv {
  url: string;
  anonKey: string;
}

export function readSupabaseEnv(): SupabaseEnv {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are not set');
  }
  return { url, anonKey };
}

/**
 * Framework-agnostic factory: apps pass their cookie adapter
 * (next/headers cookies in RSC, request/response cookies in middleware).
 */
export function createSupabaseServerClient(cookies: CookieMethodsServer, env = readSupabaseEnv()) {
  return createServerClient(env.url, env.anonKey, { cookies });
}
