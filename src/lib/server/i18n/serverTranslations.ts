// ---
// Server-side translation utility.
// Loads message strings from src/locales/{locale}.json without requiring
// React / next-intl hooks.  Used by API routes and server-side services that
// need to produce locale-aware strings (emails, battle/harvest/build messages,
// message summaries).
// ---

import type en from '../../../locales/en.json';

type Messages = typeof en;

// Lazy-load locale files once and cache them.
const cache: Partial<Record<string, Messages>> = {};

async function getMessages(locale: string): Promise<Messages> {
  if (!cache[locale]) {
    try {
      cache[locale] = (await import(`../../../locales/${locale}.json`)).default as Messages;
    } catch {
      // Fallback to English when the requested locale file is missing
      cache[locale] = (await import('../../../locales/en.json')).default as Messages;
    }
  }
  return cache[locale]!;
}

/**
 * Returns a translation function `t(key, params?)` for the given locale and
 * namespace.  Unresolved keys fall back to English; if the key is still
 * missing the raw key is returned so nothing silently breaks.
 *
 * @param locale  - BCP 47 locale code, e.g. 'en' or 'de'
 * @param namespace - Top-level namespace in the locale JSON, e.g. 'messages'
 */
export async function getServerT(
  locale: string,
  namespace: keyof Messages
): Promise<(key: string, params?: Record<string, string | number>) => string> {
  const messages = await getMessages(locale);
  const fallback = await getMessages('en');

  const ns = (messages[namespace] ?? fallback[namespace] ?? {}) as Record<string, string>;
  const fallbackNs = (fallback[namespace] ?? {}) as Record<string, string>;

  return (key: string, params?: Record<string, string | number>): string => {
    let msg: string = ns[key] ?? fallbackNs[key] ?? key;

    if (params) {
      for (const [k, v] of Object.entries(params)) {
        msg = msg.replaceAll(`{${k}}`, String(v));
      }
    }

    return msg;
  };
}
