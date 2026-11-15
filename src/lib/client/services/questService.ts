// ---
// Missions API client (GET / POST /api/quests) and admin test tools (POST /api/admin/quests).
// ---

import type { LocationId } from '@/shared/quests/locations';
import type { ContactId } from '@/shared/quests/npcArchetypes';
import type { QuestActionResult, QuestOverview } from '@/shared/quests/questTypes';

export type QuestAction = 'accept' | 'report' | 'abandon';
export type AdminQuestAction = 'reset' | 'accept' | 'fulfil' | 'report' | 'respawnNpcs' | 'jump';

export interface AdminQuestParams {
  questId?: string;
  contactId?: ContactId;
  locationId?: LocationId;
}

/** A request the server rejected; `message` is already localized for rule violations. */
export class QuestRequestError extends Error {
  constructor(
    message: string,
    public readonly code?: string
  ) {
    super(message);
    this.name = 'QuestRequestError';
  }
}

async function readJson<T>(response: Response): Promise<T> {
  const data = (await response.json().catch(() => null)) as (T & { error?: string; code?: string }) | null;
  if (!response.ok || data === null) {
    throw new QuestRequestError(data?.error ?? `Request failed (${response.status})`, data?.code);
  }
  return data;
}

function post<T>(url: string, body: unknown): Promise<T> {
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  }).then((response) => readJson<T>(response));
}

export async function fetchQuestOverview(): Promise<QuestOverview> {
  const response = await fetch('/api/quests', { credentials: 'include', cache: 'no-store' });
  return readJson<QuestOverview>(response);
}

export function sendQuestAction(action: QuestAction, questId: string, contactId?: ContactId): Promise<QuestActionResult> {
  return post<QuestActionResult>('/api/quests', { action, questId, contactId });
}

/** Admin test tools; quest actions answer with notifications, the others with `{ success: true }`. */
export function sendAdminQuestAction(
  action: AdminQuestAction,
  params: AdminQuestParams = {}
): Promise<Partial<QuestActionResult>> {
  return post<Partial<QuestActionResult>>('/api/admin/quests', { action, ...params });
}
