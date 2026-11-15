import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, POST } from '@/app/api/quests/route';
import { createMockSessionCookie, createRequest } from '../../helpers/apiTestHelpers';
import { QuestService } from '@/lib/server/quests/QuestService';
import { createInitialQuestState } from '@/shared/quests/questEngine';
import { QuestRuleError, type QuestActionResult, type QuestOverview } from '@/shared/quests/questTypes';

const URL = 'http://localhost:3000/api/quests';
const USER_ID = 42;

const RESULT: QuestActionResult = {
  notifications: [{ kind: 'questAccepted', questId: 'c1_first_haul' }],
  revision: 3,
};

// The service is replaced: the routes are tested without database, caches or locks
const service = {
  getOverview: vi.fn(),
  accept: vi.fn(),
  report: vi.fn(),
  abandon: vi.fn(),
};

beforeEach(() => {
  vi.spyOn(QuestService, 'getInstance').mockReturnValue(service as unknown as QuestService);
});

afterEach(() => {
  vi.restoreAllMocks();
  for (const method of Object.values(service)) method.mockReset();
});

async function post(body: unknown, options: { authenticated?: boolean; locale?: string } = {}): Promise<Response> {
  const { authenticated = true, locale } = options;
  let cookie = authenticated ? await createMockSessionCookie(USER_ID) : undefined;
  if (cookie && locale) cookie = `${cookie}; NEXT_LOCALE=${locale}`;
  return POST(createRequest(URL, 'POST', body, cookie));
}

describe('GET /api/quests', () => {
  it('getQuests_notAuthenticated_returns401', async () => {
    const response = await GET(createRequest(URL, 'GET'));

    expect(response.status).toBe(401);
    expect(service.getOverview).not.toHaveBeenCalled();
  });

  it('getQuests_authenticated_returnsTheOverviewOfTheSessionUser', async () => {
    const overview: QuestOverview = {
      state: createInitialQuestState(),
      level: 2,
      cargo: { counts: { ore_sample: 1 }, freeSlots: 15 },
      contactsInRange: ['vess'],
    };
    service.getOverview.mockResolvedValue(overview);

    const response = await GET(createRequest(URL, 'GET', undefined, await createMockSessionCookie(USER_ID)));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(overview);
    expect(service.getOverview).toHaveBeenCalledWith(expect.anything(), USER_ID);
  });

  it('getQuests_userUnknown_returns404', async () => {
    service.getOverview.mockResolvedValue(null);

    const response = await GET(createRequest(URL, 'GET', undefined, await createMockSessionCookie(USER_ID)));

    expect(response.status).toBe(404);
  });
});

describe('POST /api/quests', () => {
  it('postQuests_notAuthenticated_returns401', async () => {
    const response = await post({ action: 'accept', questId: 'c1_first_haul' }, { authenticated: false });

    expect(response.status).toBe(401);
    expect(service.accept).not.toHaveBeenCalled();
  });

  it.each([
    ['missing', { action: 'accept' }],
    ['empty', { action: 'accept', questId: '' }],
    ['not a string', { action: 'accept', questId: 7 }],
  ])('postQuests_questId %s_returns400', async (_name, body) => {
    const response = await post(body);

    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe('Missing or invalid quest ID');
    expect(service.accept).not.toHaveBeenCalled();
  });

  it('postQuests_bodyIsNotJson_returns400', async () => {
    const cookie = await createMockSessionCookie(USER_ID);
    const request = createRequest(URL, 'POST', undefined, cookie);

    const response = await POST(request);

    expect(response.status).toBe(400);
  });

  it('postQuests_unknownAction_returns400', async () => {
    const response = await post({ action: 'complete', questId: 'c1_first_haul' });

    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe('Invalid action');
  });

  it('postQuests_accept_callsTheServiceAndReturnsItsResult', async () => {
    service.accept.mockResolvedValue(RESULT);

    const response = await post({ action: 'accept', questId: 'c1_first_haul' });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(RESULT);
    expect(service.accept).toHaveBeenCalledWith(expect.anything(), USER_ID, 'c1_first_haul');
  });

  it('postQuests_abandon_callsTheServiceAndReturnsItsResult', async () => {
    service.abandon.mockResolvedValue(RESULT);

    const response = await post({ action: 'abandon', questId: 'c1_first_haul' });

    expect(response.status).toBe(200);
    expect(service.abandon).toHaveBeenCalledWith(expect.anything(), USER_ID, 'c1_first_haul');
  });

  it('postQuests_reportWithContact_callsTheServiceWithTheContact', async () => {
    service.report.mockResolvedValue(RESULT);

    const response = await post({ action: 'report', questId: 'c1_first_haul', contactId: 'vess' });

    expect(response.status).toBe(200);
    expect(service.report).toHaveBeenCalledWith(expect.anything(), USER_ID, 'c1_first_haul', 'vess');
  });

  it.each([
    ['missing', undefined],
    ['unknown', 'nobody'],
    ['not a string', 1],
  ])('postQuests_reportWithContactId %s_returns400', async (_name, contactId) => {
    const response = await post({ action: 'report', questId: 'c1_first_haul', contactId });

    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe('Missing or invalid contact ID');
    expect(service.report).not.toHaveBeenCalled();
  });

  it('postQuests_ruleViolation_returns400WithCodeAndEnglishText', async () => {
    service.report.mockRejectedValue(new QuestRuleError('contactOutOfRange'));

    const response = await post({ action: 'report', questId: 'c1_first_haul', contactId: 'vess' });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.code).toBe('contactOutOfRange');
    expect(data.error).not.toContain('errors.');
    expect(data.error).not.toContain('Quest rule violated');
  });

  it('postQuests_ruleViolationWithGermanLocale_returnsTheGermanText', async () => {
    service.accept.mockRejectedValue(new QuestRuleError('notAvailable'));

    const english = await (await post({ action: 'accept', questId: 'c3_thin_the_herd' })).json();
    const german = await (await post({ action: 'accept', questId: 'c3_thin_the_herd' }, { locale: 'de' })).json();

    expect(german.code).toBe('notAvailable');
    expect(german.error).not.toBe(english.error);
    expect(german.error).not.toContain('errors.');
  });

  it('postQuests_unexpectedServiceError_returns500WithoutDetails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    service.accept.mockRejectedValue(new Error('connection lost'));

    const response = await post({ action: 'accept', questId: 'c1_first_haul' });

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Server error' });
  });
});
