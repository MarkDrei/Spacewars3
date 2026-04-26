import { describe, test, expect } from 'vitest';
import { POST } from '@/app/api/set-locale/route';
import { createRequest } from '../../helpers/apiTestHelpers';

describe('set-locale API Route', () => {
  test('setLocale_noBody_returns400', async () => {
    const request = createRequest('http://localhost:3000/api/set-locale', 'POST', {});
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  test('setLocale_unsupportedLocale_returns400', async () => {
    const request = createRequest('http://localhost:3000/api/set-locale', 'POST', { locale: 'fr' });
    const response = await POST(request);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('Unsupported locale');
  });

  test('setLocale_englishLocale_returns200AndSetsCookie', async () => {
    const request = createRequest('http://localhost:3000/api/set-locale', 'POST', { locale: 'en' });
    const response = await POST(request);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.ok).toBe(true);
    // Cookie should be set
    const setCookie = response.headers.get('set-cookie');
    expect(setCookie).toContain('NEXT_LOCALE=en');
  });

  test('setLocale_germanLocale_returns200AndSetsCookie', async () => {
    const request = createRequest('http://localhost:3000/api/set-locale', 'POST', { locale: 'de' });
    const response = await POST(request);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.ok).toBe(true);
    const setCookie = response.headers.get('set-cookie');
    expect(setCookie).toContain('NEXT_LOCALE=de');
  });
});
