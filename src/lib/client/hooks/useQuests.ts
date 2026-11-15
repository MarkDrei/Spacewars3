import { useCallback, useEffect, useRef, useState } from 'react';
import type { QuestOverview } from '@/shared/quests/questTypes';
import { fetchQuestOverview } from '../services/questService';
import { startVisibilityAwarePolling } from '../polling/visibilityPolling';

interface UseQuestsOptions {
  /** Reload periodically (the contacts in hail range change while the ship moves). */
  pollIntervalMs?: number;
  /** Reload whenever this value changes (`questRevision` of the world poll). */
  revision?: number;
}

interface UseQuestsResult {
  overview: QuestOverview | null;
  isLoading: boolean;
  error: string | null;
  /** Reloads the overview; resolves when the new state is applied. */
  reload: () => Promise<void>;
}

/** Mission state of the player (quests, achievements, discovered locations, mission cargo). */
export function useQuests({ pollIntervalMs, revision }: UseQuestsOptions = {}): UseQuestsResult {
  const [overview, setOverview] = useState<QuestOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(false);
  // Only the answer to the latest request is applied
  const requestIdRef = useRef(0);

  const reload = useCallback((): Promise<void> => {
    const load = async (): Promise<void> => {
      const requestId = ++requestIdRef.current;
      try {
        const result = await fetchQuestOverview();
        if (!isMountedRef.current || requestId !== requestIdRef.current) return;
        setOverview(result);
        setError(null);
      } catch (err) {
        if (!isMountedRef.current || requestId !== requestIdRef.current) return;
        setError(err instanceof Error ? err.message : 'Failed to load missions');
      } finally {
        if (isMountedRef.current && requestId === requestIdRef.current) setIsLoading(false);
      }
    };
    return load();
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Initial load, and again whenever the server reports a new revision
  useEffect(() => {
    void reload();
  }, [reload, revision]);

  useEffect(() => {
    if (!pollIntervalMs) return;
    return startVisibilityAwarePolling(() => void reload(), pollIntervalMs);
  }, [pollIntervalMs, reload]);

  return { overview, isLoading, error, reload };
}
