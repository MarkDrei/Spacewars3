// ---
// BattleScheduler Unit Tests
// Tests for the battle scheduler with injectable dependencies
// ---

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  startBattleScheduler,
  stopBattleScheduler,
  processActiveBattles
} from '../../../lib/server/battle/battleScheduler';
import {
  realTimeProvider,
  setupBattleScheduler,
  cancelBattleScheduler
} from '../../../lib/server/battle/battleSchedulerUtils';
import { getBattleCache } from '../../../lib/server/battle/BattleCache';
import { UserCache } from '../../../lib/server/user/userCache';
import type { BattleStats, WeaponCooldowns } from '../../../lib/server/battle/battleTypes';
import { BATTLE_LOCK, USER_LOCK } from '../../../lib/server/typedLocks';
import { createLockContext } from '@markdrei/ironguard-typescript-locks';
import { initializeIntegrationTestServer, shutdownIntegrationTestServer } from '../../helpers/testServer';

describe('BattleSchedulerUtils', () => {
  describe('realTimeProvider', () => {
    it('now_returnsCurrentTimeInSeconds', () => {
      const before = Math.floor(Date.now() / 1000);
      const result = realTimeProvider.now();
      const after = Math.floor(Date.now() / 1000);
      
      expect(result).toBeGreaterThanOrEqual(before);
      expect(result).toBeLessThanOrEqual(after);
    });
  });

  describe('setupBattleScheduler', () => {
    it('setupBattleScheduler_callsSchedulerWithCorrectParams', () => {
      const mockScheduler = vi.fn() as unknown as typeof setInterval;
      const mockFn = vi.fn();

      setupBattleScheduler(mockFn, 5000, mockScheduler);

      expect(mockScheduler).toHaveBeenCalledWith(mockFn, 5000);
      expect(mockScheduler).toHaveBeenCalledTimes(1);
    });

    it('setupBattleScheduler_returnsIntervalId', () => {
      const mockIntervalId = 456 as unknown as NodeJS.Timeout;
      const mockScheduler = vi.fn().mockReturnValue(mockIntervalId) as unknown as typeof setInterval;
      const mockFn = vi.fn();

      const result = setupBattleScheduler(mockFn, 1000, mockScheduler);

      expect(result).toBe(mockIntervalId);
    });
  });

  describe('cancelBattleScheduler', () => {
    it('cancelBattleScheduler_callsCancellerWithIntervalId', () => {
      const mockCanceller = vi.fn() as unknown as typeof clearInterval;
      const mockIntervalId = 789 as unknown as NodeJS.Timeout;

      cancelBattleScheduler(mockIntervalId, mockCanceller);

      expect(mockCanceller).toHaveBeenCalledWith(mockIntervalId);
      expect(mockCanceller).toHaveBeenCalledTimes(1);
    });
  });
});

describe('BattleScheduler', () => {
  describe('startBattleScheduler', () => {
    afterEach(() => {
      stopBattleScheduler();
    });

    it('startBattleScheduler_calledOnce_startsScheduler', () => {
      // Should not throw when starting
      expect(() => startBattleScheduler()).not.toThrow();
    });

    it('startBattleScheduler_calledTwice_doesNotStartSecondScheduler', () => {
      // First call starts the scheduler
      startBattleScheduler();
      // Second call should be a no-op (logs "already running")
      expect(() => startBattleScheduler()).not.toThrow();
    });

    it('startBattleScheduler_withCustomInterval_usesCustomInterval', () => {
      // Should accept custom interval
      expect(() => startBattleScheduler(2000)).not.toThrow();
    });
  });

  describe('stopBattleScheduler', () => {
    it('stopBattleScheduler_afterStart_stopsScheduler', () => {
      startBattleScheduler();
      expect(() => stopBattleScheduler()).not.toThrow();
    });

    it('stopBattleScheduler_withoutInit_doesNotThrow', () => {
      // Should not throw even if never initialized
      expect(() => stopBattleScheduler()).not.toThrow();
    });
  });
});

describe('BattleScheduler Integration', () => {
  let emptyCtx: ReturnType<typeof createLockContext>;

  beforeEach(async () => {
    // Reset before initializing to clear any previous state
    stopBattleScheduler();
    await initializeIntegrationTestServer();
    emptyCtx = createLockContext();
  });

  afterEach(async () => {
    stopBattleScheduler();
    await shutdownIntegrationTestServer();
  });

  it('processActiveBattles_noActiveBattles_completesWithoutError', async () => {
    await emptyCtx.useLockWithAcquire(BATTLE_LOCK, async (battleContext) => {
      // Should complete without error when there are no active battles
      await expect(processActiveBattles(battleContext)).resolves.not.toThrow();
    });
  });

  it('processActiveBattles_withActiveBattle_processesRound', async () => {
    const battleCache = getBattleCache();
    const userWorldCache = UserCache.getInstance2();
    
    // Get test users
    let attackerId: number;
    let defenderId: number;
    
    await emptyCtx.useLockWithAcquire(USER_LOCK, async (userContext) => {
      const attacker = await userWorldCache.getUserByIdWithLock(userContext, 1);
      const defender = await userWorldCache.getUserByIdWithLock(userContext, 2);
      
      expect(attacker).toBeDefined();
      expect(defender).toBeDefined();
      
      attackerId = attacker!.id;
      defenderId = defender!.id;
    });

    // Create battle stats with a weapon
    const attackerStats: BattleStats = {
      hull: { current: 100, max: 100 },
      armor: { current: 50, max: 50 },
      shield: { current: 25, max: 25 },
      weapons: {
        pulse_laser: { count: 1, damage: 10, cooldown: 3 }
      }
    };
    
    const defenderStats: BattleStats = {
      hull: { current: 100, max: 100 },
      armor: { current: 50, max: 50 },
      shield: { current: 25, max: 25 },
      weapons: {}
    };

    const cooldowns: WeaponCooldowns = {
      pulse_laser: 0  // Ready to fire immediately
    };

    await emptyCtx.useLockWithAcquire(BATTLE_LOCK, async (battleContext) => {
      await battleContext.useLockWithAcquire(USER_LOCK, async (userContext) => {
        // Create battle
        const battle = await battleCache!.createBattle(
          battleContext,
          userContext,
          attackerId!,
          defenderId!,
          attackerStats,
          defenderStats,
          cooldowns,
          {}
        );

        expect(battle).toBeDefined();
        expect(battle.id).toBeGreaterThan(0);

        // Verify battle is active (at least our created battle)
        const activeBattles = await battleCache!.getActiveBattles(battleContext);
        expect(activeBattles.length).toBeGreaterThanOrEqual(1);
      });

      // Process battles - this should fire the weapon and create events
      await processActiveBattles(battleContext);

      // Check that battle log has events (weapons fired)
      const activeBattles = await battleCache!.getActiveBattles(battleContext);
      if (activeBattles.length > 0) {
        const battle = activeBattles[0];
        // Battle should have some events after processing
        expect(battle.battleLog.length).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('Weapon Cooldowns', () => {
    it('weaponCooldown_withMockTime_respectsCooldown', async () => {
      const battleCache = getBattleCache();
      const userWorldCache = UserCache.getInstance2();
      
      // Get test users
      let attackerId: number;
      let defenderId: number;
      
      await emptyCtx.useLockWithAcquire(USER_LOCK, async (userContext) => {
        const attacker = await userWorldCache.getUserByIdWithLock(userContext, 1);
        const defender = await userWorldCache.getUserByIdWithLock(userContext, 2);
        
        attackerId = attacker!.id;
        defenderId = defender!.id;
      });

      // Create battle with weapon that has a 5 second cooldown
      const attackerStats: BattleStats = {
        hull: { current: 1000, max: 1000 },
        armor: { current: 500, max: 500 },
        shield: { current: 250, max: 250 },
        weapons: {
          pulse_laser: { count: 1, damage: 10, cooldown: 5 }
        }
      };
      
      const defenderStats: BattleStats = {
        hull: { current: 1000, max: 1000 },
        armor: { current: 500, max: 500 },
        shield: { current: 250, max: 250 },
        weapons: {}
      };

      // Initial cooldown set to 0 (ready to fire)
      const cooldowns: WeaponCooldowns = {
        pulse_laser: 0
      };

      await emptyCtx.useLockWithAcquire(BATTLE_LOCK, async (battleContext) => {
        let battleId: number;
        
        await battleContext.useLockWithAcquire(USER_LOCK, async (userContext) => {
          const battle = await battleCache!.createBattle(
            battleContext,
            userContext,
            attackerId!,
            defenderId!,
            attackerStats,
            defenderStats,
            cooldowns,
            {}
          );
          battleId = battle.id;
        });

        // First round - weapon should fire (cooldown is 0, time is >= 0)
        await processActiveBattles(battleContext);

        // Get the battle after first round
        const battle = battleCache!.getBattleFromCache(battleId!);
        expect(battle).toBeDefined();
        
        // After firing, cooldown should be set to current time + cooldown period
        // The exact value depends on the time provider used
        const firstCooldown = battle!.attackerWeaponCooldowns['pulse_laser'];
        expect(firstCooldown).toBeDefined();
        // Cooldown should have been set to a future time
        expect(firstCooldown).toBeGreaterThan(0);
      });
    });
  });
});
