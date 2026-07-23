import { cookies } from 'next/headers';
import type { Locale } from './dictionaries';

export const LOCALE_COOKIE = 'templeos-lang';

/** Server-side locale resolution — cookie set by the LanguageSwitcher. */
export async function getLocale(): Promise<Locale> {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return value === 'bn' ? 'bn' : 'en';
}
