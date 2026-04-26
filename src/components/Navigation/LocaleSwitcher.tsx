'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';

const SUPPORTED_LOCALES = ['en', 'de'] as const;
type SupportedLocale = typeof SUPPORTED_LOCALES[number];

const LocaleSwitcher: React.FC = () => {
  const currentLocale = useLocale();
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  const handleLocaleChange = async (locale: SupportedLocale) => {
    if (locale === currentLocale || isPending) return;
    setIsPending(true);
    try {
      const response = await fetch('/api/set-locale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ locale }),
      });
      if (response.ok) {
        router.refresh();
      }
    } catch {
      // silently ignore network errors
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="locale-switcher" aria-label="Language selector">
      {SUPPORTED_LOCALES.map((locale) => (
        <button
          key={locale}
          className={`locale-switcher__btn${currentLocale === locale ? ' locale-switcher__btn--active' : ''}`}
          onClick={() => handleLocaleChange(locale)}
          disabled={isPending || currentLocale === locale}
          aria-pressed={currentLocale === locale}
        >
          {locale.toUpperCase()}
        </button>
      ))}
    </div>
  );
};

export default LocaleSwitcher;
