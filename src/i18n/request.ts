import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';
import { routing } from './routing';

export default getRequestConfig(async () => {
  // Read locale from NEXT_LOCALE cookie
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get('NEXT_LOCALE')?.value;

  // Validate and fall back to default locale
  const locale =
    cookieLocale && (routing.locales as ReadonlyArray<string>).includes(cookieLocale)
      ? cookieLocale
      : routing.defaultLocale;

  const messages = (await import(`../locales/${locale}.json`)).default;

  return {
    locale,
    messages,
  };
});
