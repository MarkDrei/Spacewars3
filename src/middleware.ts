import { NextResponse } from 'next/server';

// Locale resolution is handled in src/i18n/request.ts via the NEXT_LOCALE cookie.
// Rewriting through next-intl middleware requires locale-segmented routes, which
// this app does not use and would turn / into a 404.
export default function middleware() {
  return NextResponse.next();
}
