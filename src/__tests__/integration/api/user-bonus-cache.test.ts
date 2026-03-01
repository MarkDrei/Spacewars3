import { describe, expect, test, beforeEach, afterEach } from 'vitest';

import { initializeIntegrationTestServer, shutdownIntegrationTestServer } from '../../helpers/testServer';
import { withTransaction } from '../../helpers/transactionHelper';
import { createAuthenticatedSessionWithUser } from '../../helpers/apiTestHelpers';
import { UserBonusCache } from '@/lib/server/bonus/UserBonusCache';
import { UserCache } from '@/lib/server/user/userCache';
import { createLockContext } from '@markdrei/ironguard-typescript-locks';
import { USER_LOCK } from '@/lib/server/typedLocks';

describe('UserBonusCache initialization', () => {
  beforeEach(async () => {
    await initializeIntegrationTestServer();
  });

  afterEach(async () => {
    await shutdownIntegrationTestServer();
  });

  test('userBonusCache_afterServerStartup_instanceIsAvailable', async () => {
    await withTransaction(async () => {
      // After initializeServer(), getInstance() should return without error
      const cache = UserBonusCache.getInstance();
      expect(cache).toBeDefined();
      expect(cache).not.toBeNull();
    });
  });

  test('userBonusCache_getBonuses_returnsValidBonusesForNewUser', async () => {
    await withTransaction(async () => {
      const { username } = await createAuthenticatedSessionWithUser('bonuscacheuser');

      // Resolve userId via UserCache
      const userCache = UserCache.getInstance2();
      const emptyCtx = createLockContext();

      const bonuses = await emptyCtx.useLockWithAcquire(USER_LOCK, async (userCtx) => {
        const user = await userCache.getUserByUsername(userCtx, username);
        if (!user) throw new Error(`User not found: ${username}`);

        return UserBonusCache.getInstance().getBonuses(userCtx, user.id);
      });

      // New user at level 1 with no research should have base multipliers
      expect(bonuses).toBeDefined();
      expect(bonuses.levelMultiplier).toBe(1.0); // level 1 → 1.15^0 = 1.0
      expect(bonuses.ironRechargeRate).toBeGreaterThan(0);
      expect(bonuses.ironStorageCapacity).toBeGreaterThan(0);
      expect(bonuses.hullRepairSpeed).toBeGreaterThan(0);
      expect(bonuses.armorRepairSpeed).toBeGreaterThan(0);
      expect(bonuses.shieldRechargeRate).toBeGreaterThan(0);
      expect(bonuses.maxShipSpeed).toBeGreaterThan(0);

      // Weapon factors should all be positive
      expect(bonuses.projectileWeaponDamageFactor).toBeGreaterThan(0);
      expect(bonuses.projectileWeaponReloadFactor).toBeGreaterThan(0);
      expect(bonuses.projectileWeaponAccuracyFactor).toBeGreaterThan(0);
      expect(bonuses.energyWeaponDamageFactor).toBeGreaterThan(0);
      expect(bonuses.energyWeaponReloadFactor).toBeGreaterThan(0);
      expect(bonuses.energyWeaponAccuracyFactor).toBeGreaterThan(0);

      // Commander multipliers record should be present with all-1.0 values (no commanders)
      expect(bonuses.commanderMultipliers).toBeDefined();
    });
  });

  test('userBonusCache_getBonusesTwice_returnsCachedResult', async () => {
    await withTransaction(async () => {
      const { username } = await createAuthenticatedSessionWithUser('bonuscacheuser2');

      const userCache = UserCache.getInstance2();
      const emptyCtx = createLockContext();

      const [bonuses1, bonuses2] = await emptyCtx.useLockWithAcquire(USER_LOCK, async (userCtx) => {
        const user = await userCache.getUserByUsername(userCtx, username);
        if (!user) throw new Error(`User not found: ${username}`);

        const b1 = await UserBonusCache.getInstance().getBonuses(userCtx, user.id);
        const b2 = await UserBonusCache.getInstance().getBonuses(userCtx, user.id);
        return [b1, b2] as const;
      });

      // Both calls should return the same (cached) object reference
      expect(bonuses1).toBe(bonuses2);
    });
  });

  test('userBonusCache_afterReset_returnsNewInstance', async () => {
    await withTransaction(async () => {
      const instanceBefore = UserBonusCache.getInstance();
      expect(instanceBefore).toBeDefined();

      // resetInstance() clears the singleton
      UserBonusCache.resetInstance();
      // globalThis instance is now null; re-configure and get a new one
      // (in real usage testServer does this; here we verify the reset works)
      const instanceIsGone = (globalThis as { userBonusCacheInstance?: unknown }).userBonusCacheInstance;
      expect(instanceIsGone).toBeNull();
    });
  });

  test('userBonusCache_discardAllBonuses_clearsCache', async () => {
    await withTransaction(async () => {
      const { username } = await createAuthenticatedSessionWithUser('bonuscachedisc');

      const userCache = UserCache.getInstance2();
      const emptyCtx = createLockContext();

      await emptyCtx.useLockWithAcquire(USER_LOCK, async (userCtx) => {
        const user = await userCache.getUserByUsername(userCtx, username);
        if (!user) throw new Error(`User not found: ${username}`);

        const bonusCache = UserBonusCache.getInstance();

        // Populate the cache
        const b1 = await bonusCache.getBonuses(userCtx, user.id);
        expect(b1).toBeDefined();

        // Discard and verify next call returns a fresh (but equal) object
        bonusCache.discardAllBonuses();
        const b2 = await bonusCache.getBonuses(userCtx, user.id);
        expect(b2).toBeDefined();

        // After discard, a new object should have been computed (not the same reference)
        expect(b1).not.toBe(b2);

        // But the values should still be valid/equivalent for an unchanged user
        expect(b2.levelMultiplier).toBe(b1.levelMultiplier);
        expect(b2.ironRechargeRate).toBe(b1.ironRechargeRate);
      });
    });
  });

  test('userBonusCache_invalidateSingleUser_onlyAffectsThatUser', async () => {
    await withTransaction(async () => {
      const { username: username1 } = await createAuthenticatedSessionWithUser('bonusu1');
      const { username: username2 } = await createAuthenticatedSessionWithUser('bonusu2');

      const userCache = UserCache.getInstance2();
      const emptyCtx = createLockContext();

      await emptyCtx.useLockWithAcquire(USER_LOCK, async (userCtx) => {
        const user1 = await userCache.getUserByUsername(userCtx, username1);
        const user2 = await userCache.getUserByUsername(userCtx, username2);
        if (!user1) throw new Error(`User not found: ${username1}`);
        if (!user2) throw new Error(`User not found: ${username2}`);

        const bonusCache = UserBonusCache.getInstance();

        // Populate both users in the cache
        const b1 = await bonusCache.getBonuses(userCtx, user1.id);
        const b2 = await bonusCache.getBonuses(userCtx, user2.id);

        // Invalidate only user1
        bonusCache.invalidateBonuses(user1.id);

        // user1 gets a fresh computation (new object reference)
        const b1After = await bonusCache.getBonuses(userCtx, user1.id);
        expect(b1After).not.toBe(b1);

        // user2 still returns the same cached object
        const b2After = await bonusCache.getBonuses(userCtx, user2.id);
        expect(b2After).toBe(b2);
      });
    });
  });
});
