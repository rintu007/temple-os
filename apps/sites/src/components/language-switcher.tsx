'use client';

import { useRouter } from 'next/navigation';
import { cn } from '@templeos/ui';
import { LOCALES, LOCALE_LABELS, type Locale } from '@/i18n/dictionaries';

/** Cookie-based locale toggle; server components re-render via router.refresh(). */
export function LanguageSwitcher({ current }: { current: Locale }) {
  const router = useRouter();

  function switchTo(locale: Locale) {
    if (locale === current) return;
    document.cookie = `templeos-lang=${locale};path=/;max-age=31536000;samesite=lax`;
    router.refresh();
  }

  return (
    <div
      role="group"
      aria-label="Language"
      className="flex items-center rounded-full border border-border p-0.5 text-xs font-semibold"
    >
      {LOCALES.map((locale) => (
        <button
          key={locale}
          type="button"
          onClick={() => switchTo(locale)}
          aria-pressed={locale === current}
          className={cn(
            'rounded-full px-2.5 py-1 transition-colors',
            locale === current
              ? 'bg-accent text-accent-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {LOCALE_LABELS[locale]}
        </button>
      ))}
    </div>
  );
}
