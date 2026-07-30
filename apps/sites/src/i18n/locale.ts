import { cookies } from 'next/headers';
import { LOCALES, type Locale } from './dictionaries';

export const LOCALE_COOKIE = 'templeos-lang';

function isLocale(value: string | undefined): value is Locale {
  return (LOCALES as readonly string[]).includes(value ?? '');
}

/** Server-side locale resolution — cookie set by the LanguageSwitcher. */
export async function getLocale(): Promise<Locale> {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : 'en';
}
