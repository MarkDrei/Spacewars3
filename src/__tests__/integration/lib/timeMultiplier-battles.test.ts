import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { TimeMultiplierService } from '@/lib/server/timeMultiplier';
import { getBattleCache, BattleRepo } from '@/lib/server/battle/BattleCache';
import { UserCache } from '@/lib/server/user/userCache';
import { processActiveBattles } from '@/lib/server/battle/battleScheduler';
import { createLockContext } from '@markdrei/ironguard-typescript-locks';
import { BATTLE_LOCK, USER_LOCK } from '@/lib/server/typedLocks';
import type { BattleStats, WeaponCooldowns } from '@/lib/server/battle/battleTypes';
import { initializeIntegrationTestServer, shutdownIntegrationTestServer } from '../../helpers/testServer';

describe('TimeMultiplier - Battle Weapon Cooldowns', () => {
  let emptyCtx: ReturnType<typeof createLockContext>;

  beforeEach(async () => {
    // Reset singleton instances and initialize test server
    TimeMultiplierService.resetInstance();
    await initializeIntegrationTestServer();
    emptyCtx = createLockContext();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    TimeMultiplierService.resetInstance();
    await shutdownIntegrationTestServer();
  });

  test('fireWeapon_withMultiplier10_setsCooldownToOneTenth', async () => {
    // Setup: Weapon with 50 second cooldown, 10x multiplier should reduce to 5 seconds
    const battleCache = getBattleCache();
    const userWorldCache = UserCache.getInstance2();

    // Get test users
    let attackerId: number;
    let defenderId: number;
    
    await emptyCtx.useLockWithAcquire(USER_LOCK, async (userContext) => {
      const attacker = await userWorldCache.getUserByUsername(userContext, 'a');
      const defender = await userWorldCache.getUserByUsername(userContext, 'dummy');
      
      expect(attacker).not.toBeNull();
      expect(defender).not.toBeNull();
      
      attackerId = attacker!.id;
      defenderId = defender!.id;
    });

    // Set 10x multiplier for 5 minutes
    const timeService = TimeMultiplierService.getInstance();
    timeService.setMultiplier(10, 5);

    // Create battle with weapon that has a 50 second cooldown
    const attackerStats: BattleStats = {
      hull: { current: 1000, max: 1000 },
      armor: { current: 500, max: 500 },
      shield: { current: 250, max: 250 },
      weapons: {
        pulse_laser: { count: 1, damage: 10, cooldown: 50 }
      }
    };
    
    const defenderStats: BattleStats = {
      hull: { current: 1000, max: 1000 },
      armor: { current: 500, max: 500 },
      shield: { current: 250, max: 250 },
      weapons: {}
    };

    // Initial cooldown set to 0 (ready to fire immediately)
    const cooldowns: WeaponCooldowns = {
      pulse_laser: 0
    };

    let battleId: number;
    
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

        battleId = battle.id;
      });

      // Get current time before processing
      const timeBefore = Math.floor(Date.now() / 1000);

      // Process battle round - this should fire the weapon
      await processActiveBattles(battleContext);

      // Get updated battle and check cooldown
      const battle = await BattleRepo.getBattle(battleContext, battleId!);
      expect(battle).not.toBeNull();

      const updatedCooldown = battle!.attackerWeaponCooldowns.pulse_laser;
      
      // Cooldown should be set to currentTime + (50 / 10) = currentTime + 5
      // Allow small time window for processing
      const expectedCooldown = timeBefore + 5;
      expect(updatedCooldown).toBeGreaterThanOrEqual(expectedCooldown);
      expect(updatedCooldown).toBeLessThanOrEqual(expectedCooldown + 2);
    });
  });

  test('fireWeapon_multiplierExpired_usesNormalCooldown', async () => {
    // Setup: Set multiplier then let it expire
    const battleCache = getBattleCache();
    const userWorldCache = UserCache.getInstance2();

    // Get test users
    let attackerId: number;
    let defenderId: number;
    
    await emptyCtx.useLockWithAcquire(USER_LOCK, async (userContext) => {
      const attacker = await userWorldCache.getUserByUsername(userContext, 'a');
      const defender = await userWorldCache.getUserByUsername(userContext, 'dummy');
      
      expect(attacker).not.toBeNull();
      expect(defender).not.toBeNull();
      
      attackerId = attacker!.id;
      defenderId = defender!.id;
    });

    // Mock time
    const mockNow = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(mockNow);

    // Set 10x multiplier for 5 minutes
    const timeService = TimeMultiplierService.getInstance();
    timeService.setMultiplier(10, 5);
    expect(timeService.getMultiplier()).toBe(10);

    // Fast-forward time to after expiration (5 minutes + 1ms)
    vi.spyOn(Date, 'now').mockReturnValue(mockNow + 5 * 60 * 1000 + 1);
    
    // Verify multiplier expired
    expect(timeService.getMultiplier()).toBe(1);

    // Create battle with weapon that has a 30 second cooldown
    const attackerStats: BattleStats = {
      hull: { current: 1000, max: 1000 },
      armor: { current: 500, max: 500 },
      shield: { current: 250, max: 250 },
      weapons: {
        pulse_laser: { count: 1, damage: 10, cooldown: 30 }
      }
    };
    
    const defenderStats: BattleStats = {
      hull: { current: 1000, max: 1000 },
      armor: { current: 500, max: 500 },
      shield: { current: 250, max: 250 },
      weapons: {}
    };

    // Initial cooldown set to 0 (ready to fire immediately)
    const cooldowns: WeaponCooldowns = {
      pulse_laser: 0
    };

    let battleId: number;
    
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

        battleId = battle.id;
      });

      // Get current time before processing (use mocked time in seconds)
      const timeBefore = Math.floor((mockNow + 5 * 60 * 1000 + 1) / 1000);

      // Process battle round - this should fire the weapon with multiplier=1
      await processActiveBattles(battleContext);

      // Get updated battle and check cooldown
      const battle = await BattleRepo.getBattle(battleContext, battleId!);
      expect(battle).not.toBeNull();

      const updatedCooldown = battle!.attackerWeaponCooldowns.pulse_laser;
      
      // Cooldown should be set to currentTime + 30 (no multiplier effect since expired)
      // Allow small time window for processing
      const expectedCooldown = timeBefore + 30;
      expect(updatedCooldown).toBeGreaterThanOrEqual(expectedCooldown);
      expect(updatedCooldown).toBeLessThanOrEqual(expectedCooldown + 2);
    });
  });

  test('fireWeapon_withMultiplier5_respectsMinimumCooldownOf1Second', async () => {
    // Setup: Weapon with 2 second cooldown, 5x multiplier should reduce to 1 (minimum)
    const battleCache = getBattleCache();
    const userWorldCache = UserCache.getInstance2();

    // Get test users
    let attackerId: number;
    let defenderId: number;
    
    await emptyCtx.useLockWithAcquire(USER_LOCK, async (userContext) => {
      const attacker = await userWorldCache.getUserByUsername(userContext, 'a');
      const defender = await userWorldCache.getUserByUsername(userContext, 'dummy');
      
      expect(attacker).not.toBeNull();
      expect(defender).not.toBeNull();
      
      attackerId = attacker!.id;
      defenderId = defender!.id;
    });

    // Set 5x multiplier for 5 minutes
    const timeService = TimeMultiplierService.getInstance();
    timeService.setMultiplier(5, 5);

    // Create battle with weapon that has a 2 second cooldown
    const attackerStats: BattleStats = {
      hull: { current: 1000, max: 1000 },
      armor: { current: 500, max: 500 },
      shield: { current: 250, max: 250 },
      weapons: {
        pulse_laser: { count: 1, damage: 10, cooldown: 2 }
      }
    };
    
    const defenderStats: BattleStats = {
      hull: { current: 1000, max: 1000 },
      armor: { current: 500, max: 500 },
      shield: { current: 250, max: 250 },
      weapons: {}
    };

    // Initial cooldown set to 0 (ready to fire immediately)
    const cooldowns: WeaponCooldowns = {
      pulse_laser: 0
    };

    let battleId: number;
    
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

        battleId = battle.id;
      });

      // Get current time before processing
      const timeBefore = Math.floor(Date.now() / 1000);

      // Process battle round - this should fire the weapon
      await processActiveBattles(battleContext);

      // Get updated battle and check cooldown
      const battle = await BattleRepo.getBattle(battleContext, battleId!);
      expect(battle).not.toBeNull();

      const updatedCooldown = battle!.attackerWeaponCooldowns.pulse_laser;
      
      // Cooldown should be clamped to minimum of 1 second (2 / 5 = 0.4, ceil = 1, max(1, 1) = 1)
      // So cooldown should be currentTime + 1
      const expectedCooldown = timeBefore + 1;
      expect(updatedCooldown).toBeGreaterThanOrEqual(expectedCooldown);
      expect(updatedCooldown).toBeLessThanOrEqual(expectedCooldown + 2);
    });
  });

  test('fireWeapon_defaultCooldown_withMultiplier10', async () => {
    // Setup: Test default cooldown of 5 seconds (when weaponData.cooldown is undefined)
    const battleCache = getBattleCache();
    const userWorldCache = UserCache.getInstance2();

    // Get test users
    let attackerId: number;
    let defenderId: number;
    
    await emptyCtx.useLockWithAcquire(USER_LOCK, async (userContext) => {
      const attacker = await userWorldCache.getUserByUsername(userContext, 'a');
      const defender = await userWorldCache.getUserByUsername(userContext, 'dummy');
      
      expect(attacker).not.toBeNull();
      expect(defender).not.toBeNull();
      
      attackerId = attacker!.id;
      defenderId = defender!.id;
    });

    // Set 10x multiplier for 5 minutes
    const timeService = TimeMultiplierService.getInstance();
    timeService.setMultiplier(10, 5);

    // Create battle with weapon that has undefined cooldown (will default to 5)
    const attackerStats: BattleStats = {
      hull: { current: 1000, max: 1000 },
      armor: { current: 500, max: 500 },
      shield: { current: 250, max: 250 },
      weapons: {
        pulse_laser: { count: 1, damage: 10, cooldown: undefined as unknown as number } // Force undefined
      }
    };
    
    const defenderStats: BattleStats = {
      hull: { current: 1000, max: 1000 },
      armor: { current: 500, max: 500 },
      shield: { current: 250, max: 250 },
      weapons: {}
    };

    // Initial cooldown set to 0 (ready to fire immediately)
    const cooldowns: WeaponCooldowns = {
      pulse_laser: 0
    };

    let battleId: number;
    
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

        battleId = battle.id;
      });

      // Get current time before processing
      const timeBefore = Math.floor(Date.now() / 1000);

      // Process battle round - this should fire the weapon
      await processActiveBattles(battleContext);

      // Get updated battle and check cooldown
      const battle = await BattleRepo.getBattle(battleContext, battleId!);
      expect(battle).not.toBeNull();

      const updatedCooldown = battle!.attackerWeaponCooldowns.pulse_laser;
      
      // Cooldown should be set to currentTime + (5 / 10) = currentTime + 1 (ceil of 0.5)
      const expectedCooldown = timeBefore + 1;
      expect(updatedCooldown).toBeGreaterThanOrEqual(expectedCooldown);
      expect(updatedCooldown).toBeLessThanOrEqual(expectedCooldown + 2);
    });
  });
});
