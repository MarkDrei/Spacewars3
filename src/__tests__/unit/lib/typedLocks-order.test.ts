/**
 * Compile-time regression test for the IronGuard lock hierarchy.
 *
 * The real assertion happens during `npm run typecheck` (TypeScript 7) and `next build` (TypeScript 6):
 * the `@ts-expect-error` directive fails the type check if acquiring locks out of order ever stops
 * being a type error (e.g. after a compiler or IronGuard upgrade).
 */
import { describe, it, expect } from 'vitest';
import { createLockContext } from '@markdrei/ironguard-typescript-locks';
import { USER_LOCK, WORLD_LOCK } from '@/lib/server/typedLocks';

async function acquireInDescendingOrder(): Promise<void> {
  const ctx = createLockContext();
  await ctx.useLockWithAcquire(WORLD_LOCK, async (worldCtx) => {
    // @ts-expect-error - USER_LOCK (4) must not be acquired while holding WORLD_LOCK (6)
    await worldCtx.useLockWithAcquire(USER_LOCK, async () => {});
  });
}

async function acquireInAscendingOrder(): Promise<void> {
  const ctx = createLockContext();
  await ctx.useLockWithAcquire(USER_LOCK, async (userCtx) => {
    await userCtx.useLockWithAcquire(WORLD_LOCK, async () => {});
  });
}

describe('typed lock hierarchy (compile time)', () => {
  it('useLockWithAcquire_descendingOrder_isRejectedByTypeChecker', () => {
    // Only referenced, never executed: the check is the @ts-expect-error above.
    expect(typeof acquireInDescendingOrder).toBe('function');
  });

  it('useLockWithAcquire_ascendingOrder_isAcceptedAndRuns', async () => {
    await expect(acquireInAscendingOrder()).resolves.toBeUndefined();
  });
});
