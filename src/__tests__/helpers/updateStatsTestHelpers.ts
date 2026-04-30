import { createLockContext, type LockContext, type LocksAtMostAndHas4 } from '@markdrei/ironguard-typescript-locks';
import { USER_LOCK } from '@/lib/server/typedLocks';
import { TechService } from '@/lib/server/techs/TechService';
import type { UserBonuses } from '@/lib/server/bonus/userBonusTypes';
import type { User } from '@/lib/server/user/user';
import { vi } from 'vitest';

type UserLockContext = LockContext<LocksAtMostAndHas4>;

export async function withUserLock<T>(callback: (context: UserLockContext) => Promise<T>): Promise<T> {
  const context = createLockContext();
  return context.useLockWithAcquire(USER_LOCK, callback);
}

export async function updateStatsWithMockedBuildRefresh(
  user: User,
  now: number,
  bonuses?: UserBonuses
) {
  const processCompletedBuilds = vi.fn().mockResolvedValue({ completed: [] });
  const getInstanceSpy = vi
    .spyOn(TechService, 'getInstance')
    .mockReturnValue({ processCompletedBuilds } as unknown as TechService);

  try {
    return await withUserLock(async (context) => user.updateStats(now, context, bonuses));
  } finally {
    getInstanceSpy.mockRestore();
  }
}