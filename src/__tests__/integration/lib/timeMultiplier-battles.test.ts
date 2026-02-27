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
      
      // Cooldown should be ceil(612 / 10) = 62 seconds
      // pulse_laser base: 720s. User 'a' has energyRechargeRate:1 (15% → speed factor 1/0.85≈1.176)
      // bonusedCooldown = ceil(720 / 1.176) = 612s. With 10x: ceil(612/10) = 62s.
      const expectedCooldown = timeBefore + 62;
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
      
      // Cooldown should be 612 seconds (no multiplier since expired)
      // User 'a' energyRechargeRate:1 gives bonusedCooldown=612s; multiplier=1 → 612s.
      const expectedCooldown = timeBefore + 612;
      expect(updatedCooldown).toBeGreaterThanOrEqual(expectedCooldown);
      expect(updatedCooldown).toBeLessThanOrEqual(expectedCooldown + 2);
    });
  });

  test('fireWeapon_withMultiplier5_reducesCooldown', async () => {
    // Setup: pulse_laser base cooldown 720s, 5x multiplier reduces to 144s
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
      
      // Cooldown should be ceil(612 / 5) = 123 seconds
      // User 'a' energyRechargeRate:1 → bonusedCooldown=612s; 5x multiplier → ceil(612/5)=123s.
      const expectedCooldown = timeBefore + 123;
      expect(updatedCooldown).toBeGreaterThanOrEqual(expectedCooldown);
      expect(updatedCooldown).toBeLessThanOrEqual(expectedCooldown + 2);
    });
  });

  test('fireWeapon_defaultCooldown_withMultiplier10', async () => {
    // Setup: Weapon with no BattleStats cooldown; battleScheduler uses TechFactory spec (720s for pulse_laser)
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
      
      // Cooldown should be ceil(612 / 10) = 62 seconds
      // BattleStats.cooldown is ignored; battleScheduler uses TechFactory spec (720s for pulse_laser).
      // User 'a' energyRechargeRate:1 → bonusedCooldown=612s; 10x multiplier → 62s.
      const expectedCooldown = timeBefore + 62;
      expect(updatedCooldown).toBeGreaterThanOrEqual(expectedCooldown);
      expect(updatedCooldown).toBeLessThanOrEqual(expectedCooldown + 2);
    });
  });
});
