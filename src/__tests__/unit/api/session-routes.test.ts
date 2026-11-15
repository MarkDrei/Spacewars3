import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { GET as sessionGET } from '@/app/api/session/route';
import { POST as logoutPOST } from '@/app/api/logout/route';
import { GET as techCatalogGET } from '@/app/api/tech-catalog/route';
import { POST as summarizePOST } from '@/app/api/messages/summarize/route';
import { createRequest, createMockSessionCookie } from '../../helpers/apiTestHelpers';
import { TechFactory } from '@/lib/server/techs/TechFactory';
import { UserCache } from '@/lib/server/user/userCache';
import { MessageCache } from '@/lib/server/messages/MessageCache';

const { getDatabase } = vi.hoisted(() => ({ getDatabase: vi.fn() }));
vi.mock('@/lib/server/database', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/server/database')>()),
  getDatabase,
}));

const authed = async (url: string, method: string) =>
  createRequest(url, method, undefined, await createMockSessionCookie(1));

describe('GET /api/session', () => {
  const query = vi.fn();

  beforeEach(() => {
    query.mockReset();
    getDatabase.mockResolvedValue({ query });
  });

  test('session_noCookie_returnsLoggedOutWithoutDbAccess', async () => {
    const response = await sessionGET(createRequest('http://localhost/api/session', 'GET'));

    expect(await response.json()).toEqual({ loggedIn: false });
    expect(getDatabase).not.toHaveBeenCalled();
  });

  test('session_validUser_returnsUsernameAndShip', async () => {
    query.mockResolvedValue({ rows: [{ username: 'a', ship_id: 5 }] });

    const response = await sessionGET(await authed('http://localhost/api/session', 'GET'));

    expect(await response.json()).toEqual({ loggedIn: true, username: 'a', shipId: 5 });
    expect(query).toHaveBeenCalledWith(expect.stringContaining('FROM users WHERE id = $1'), [1]);
  });

  test('session_userDeleted_returnsLoggedOut', async () => {
    query.mockResolvedValue({ rows: [] });

    const response = await sessionGET(await authed('http://localhost/api/session', 'GET'));

    expect(await response.json()).toEqual({ loggedIn: false });
  });
});

describe('POST /api/logout', () => {
  test('logout_withSession_clearsSessionCookie', async () => {
    const response = await logoutPOST(await authed('http://localhost/api/logout', 'POST'));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    const setCookie = response.headers.get('set-cookie') ?? '';
    expect(setCookie).toMatch(/spacewars-session=;/);
    expect(setCookie).toMatch(/Max-Age=0/i);
  });
});

describe('GET /api/tech-catalog', () => {
  test('techCatalog_notAuthenticated_returns401', async () => {
    const response = await techCatalogGET(createRequest('http://localhost/api/tech-catalog', 'GET'));
    expect(response.status).toBe(401);
  });

  test('techCatalog_authenticated_returnsAllSpecsAndKeys', async () => {
    const response = await techCatalogGET(await authed('http://localhost/api/tech-catalog', 'GET'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.weaponKeys).toEqual(TechFactory.getWeaponKeys());
    expect(data.defenseKeys).toEqual(TechFactory.getDefenseKeys());
    expect(Object.keys(data.weapons)).toEqual(expect.arrayContaining(TechFactory.getWeaponKeys()));
  });
});

describe('POST /api/messages/summarize', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('summarize_notAuthenticated_returns401', async () => {
    const response = await summarizePOST(createRequest('http://localhost/api/messages/summarize', 'POST'));
    expect(response.status).toBe(401);
  });

  test('summarize_userWithGermanLocale_summarizesInGerman', async () => {
    vi.spyOn(UserCache, 'getInstance2').mockReturnValue({
      getUserByIdWithoutRefreshWithLock: vi.fn().mockResolvedValue({ preferredLocale: 'de' }),
    } as unknown as UserCache);
    const summarizeMessages = vi.fn().mockResolvedValue('Zusammenfassung');
    vi.spyOn(MessageCache, 'getInstance').mockReturnValue({ summarizeMessages } as unknown as MessageCache);

    const response = await summarizePOST(await authed('http://localhost/api/messages/summarize', 'POST'));

    expect(await response.json()).toEqual({ success: true, summary: 'Zusammenfassung' });
    expect(summarizeMessages).toHaveBeenCalledWith(expect.anything(), 1, 'de');
  });

  test('summarize_userWithoutLocale_fallsBackToEnglish', async () => {
    vi.spyOn(UserCache, 'getInstance2').mockReturnValue({
      getUserByIdWithoutRefreshWithLock: vi.fn().mockResolvedValue(null),
    } as unknown as UserCache);
    const summarizeMessages = vi.fn().mockResolvedValue('Summary');
    vi.spyOn(MessageCache, 'getInstance').mockReturnValue({ summarizeMessages } as unknown as MessageCache);

    await summarizePOST(await authed('http://localhost/api/messages/summarize', 'POST'));

    expect(summarizeMessages).toHaveBeenCalledWith(expect.anything(), 1, 'en');
  });
});
