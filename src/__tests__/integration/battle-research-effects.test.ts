// ---
// Battle Research Effects Integration Test
// Verifies that research upgrades affect weapon reload times in battles
// ---

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BattleCache, getBattleCache } from '../../lib/server/battle/BattleCache';
import { UserCache } from '../../lib/server/user/userCache';
import { TechFactory } from '../../lib/server/techs/TechFactory';
import type { BattleStats, WeaponCooldowns } from '../../lib/server/battle/battleTypes';
import { BATTLE_LOCK, USER_LOCK } from '@/lib/server/typedLocks';
import { createLockContext } from '@markdrei/ironguard-typescript-locks';
import { initializeIntegrationTestServer, shutdownIntegrationTestServer } from '../helpers/testServer';
import { withTransaction } from '../helpers/transactionHelper';

describe('Battle Research Effects Integration', () => {

  let battleCache: BattleCache | null;
  let userCache: UserCache;
  let emptyCtx: ReturnType<typeof createLockContext>;
  
  beforeEach(async () => {
    await initializeIntegrationTestServer();
    emptyCtx = createLockContext();
    battleCache = getBattleCache();
    userCache = UserCache.getInstance2();
  });

  afterEach(async () => {
    await shutdownIntegrationTestServer();
  });

  describe('Research Effects on Battle Cooldowns', () => {
    it('researchUpgrade_projectileWeapon_reducesReloadTime', async () => {
      await withTransaction(async () => {
        await emptyCtx.useLockWithAcquire(BATTLE_LOCK, async (battleCtx) => {
          // === Phase 1: Get users and verify initial state ===
          let attackerId = 0, defenderId = 0;
          await battleCtx.useLockWithAcquire(USER_LOCK, async (userCtx) => {
            const attacker = (await userCache.getUserByUsername(userCtx, 'a'))!;
            const defender = (await userCache.getUserByUsername(userCtx, 'dummy'))!;
            attackerId = attacker.id;
            defenderId = defender.id;

            // Verify attacker has projectile weapons
            expect(attacker.techCounts.auto_turret).toBeGreaterThan(0);
            
            // Calculate initial reload time with level 1 research (default)
            // Level 1 projectileReloadRate = 10% faster = 0.9x multiplier
            // auto_turret: 12min * 60 / 240 = 3s base, * 0.9 = 2.7s
            const initialReloadTime = TechFactory.calculateWeaponReloadTime('auto_turret', attacker.techTree);
            expect(initialReloadTime).toBeCloseTo(2.7, 1);
          });

          // === Phase 2: Upgrade research and recalculate ===
          await battleCtx.useLockWithAcquire(USER_LOCK, async (userCtx) => {
            const attacker = (await userCache.getUserByUsername(userCtx, 'a'))!;
            
            // Upgrade projectile reload rate research to level 3
            // Level 3 = 10 + 10 + 10 = 30% faster = 0.7x multiplier
            attacker.techTree.projectileReloadRate = 3;
            userCache.updateUserInCache(userCtx, attacker);

            // Recalculate reload time with upgraded research
            // auto_turret: 3s base * 0.7 = 2.1s
            const upgradedReloadTime = TechFactory.calculateWeaponReloadTime('auto_turret', attacker.techTree);
            expect(upgradedReloadTime).toBeCloseTo(2.1, 1);
          });

          // === Phase 3: Create battle with upgraded research ===
          const battle = await battleCtx.useLockWithAcquire(USER_LOCK, async (userCtx) => {
            const attacker = (await userCache.getUserByUsername(userCtx, 'a'))!;
            const defender = (await userCache.getUserByUsername(userCtx, 'dummy'))!;

            // Create battle stats - these should reflect the upgraded research
            const attackerStats: BattleStats = {
              hull: { current: 100, max: 100 },
              armor: { current: 50, max: 50 },
              shield: { current: 25, max: 25 },
              weapons: {
                auto_turret: { 
                  count: attacker.techCounts.auto_turret, 
                  damage: 10, 
                  cooldown: TechFactory.calculateWeaponReloadTime('auto_turret', attacker.techTree)
                }
              }
            };
            
            const defenderStats: BattleStats = {
              hull: { current: 80, max: 80 },
              armor: { current: 40, max: 40 },
              shield: { current: 20, max: 20 },
              weapons: {}
            };

            const attackerCooldowns: WeaponCooldowns = { auto_turret: 0 };
            const defenderCooldowns: WeaponCooldowns = {};

            return await battleCache!.createBattle(
              battleCtx,
              userCtx,
              attackerId,
              defenderId,
              attackerStats,
              defenderStats,
              attackerCooldowns,
              defenderCooldowns
            );
          });

          // === Phase 4: Verify battle stats reflect upgraded research ===
          expect(battle).toBeDefined();
          expect(battle.attackerStartStats.weapons.auto_turret).toBeDefined();
          
          // The cooldown in battle stats should be ~2.1 seconds (with level 3 research)
          const battleCooldown = battle.attackerStartStats.weapons.auto_turret.cooldown;
          expect(battleCooldown).toBeCloseTo(2.1, 1);
          
          // Verify it's different from base cooldown without research
          const baseCooldown = TechFactory.getBaseBattleCooldown(TechFactory.getWeaponSpec('auto_turret')!);
          expect(battleCooldown).toBeLessThan(baseCooldown);
        });
      });
    });

    it('researchUpgrade_energyWeapon_reducesReloadTime', async () => {
      await withTransaction(async () => {
        await emptyCtx.useLockWithAcquire(BATTLE_LOCK, async (battleCtx) => {
          // === Phase 1: Get users and modify tech tree ===
          let attackerId = 0, defenderId = 0;
          await battleCtx.useLockWithAcquire(USER_LOCK, async (userCtx) => {
            const attacker = (await userCache.getUserByUsername(userCtx, 'a'))!;
            const defender = (await userCache.getUserByUsername(userCtx, 'dummy'))!;
            attackerId = attacker.id;
            defenderId = defender.id;

            // Give attacker some energy weapons
            attacker.techCounts.pulse_laser = 2;
            
            // Upgrade energy recharge rate research to level 4
            // Level 4 = 15 + 15 + 15 + 15 = 60% faster = 0.4x multiplier
            attacker.techTree.energyRechargeRate = 4;
            userCache.updateUserInCache(userCtx, attacker);

            // Calculate reload time with upgraded research
            // pulse_laser: 12min * 60 / 360 = 2s base, * 0.4 = 0.8s
            const upgradedReloadTime = TechFactory.calculateWeaponReloadTime('pulse_laser', attacker.techTree);
            expect(upgradedReloadTime).toBeCloseTo(0.8, 1);
          });

          // === Phase 2: Create battle and verify cooldowns ===
          const battle = await battleCtx.useLockWithAcquire(USER_LOCK, async (userCtx) => {
            const attacker = (await userCache.getUserByUsername(userCtx, 'a'))!;
            const defender = (await userCache.getUserByUsername(userCtx, 'dummy'))!;

            const attackerStats: BattleStats = {
              hull: { current: 100, max: 100 },
              armor: { current: 50, max: 50 },
              shield: { current: 25, max: 25 },
              weapons: {
                pulse_laser: { 
                  count: attacker.techCounts.pulse_laser, 
                  damage: 8, 
                  cooldown: TechFactory.calculateWeaponReloadTime('pulse_laser', attacker.techTree)
                }
              }
            };
            
            const defenderStats: BattleStats = {
              hull: { current: 80, max: 80 },
              armor: { current: 40, max: 40 },
              shield: { current: 20, max: 20 },
              weapons: {}
            };

            const attackerCooldowns: WeaponCooldowns = { pulse_laser: 0 };
            const defenderCooldowns: WeaponCooldowns = {};

            return await battleCache!.createBattle(
              battleCtx,
              userCtx,
              attackerId,
              defenderId,
              attackerStats,
              defenderStats,
              attackerCooldowns,
              defenderCooldowns
            );
          });

          // === Phase 3: Verify battle stats reflect upgraded research ===
          expect(battle).toBeDefined();
          expect(battle.attackerStartStats.weapons.pulse_laser).toBeDefined();
          
          // The cooldown in battle stats should be ~0.8 seconds (with level 4 research)
          const battleCooldown = battle.attackerStartStats.weapons.pulse_laser.cooldown;
          expect(battleCooldown).toBeCloseTo(0.8, 1);
          
          // Verify it's much faster than base cooldown
          const baseCooldown = TechFactory.getBaseBattleCooldown(TechFactory.getWeaponSpec('pulse_laser')!);
          expect(battleCooldown).toBeLessThan(baseCooldown * 0.5); // At least 50% faster
        });
      });
    });

    it('researchUpgrade_multipleWeapons_affectsOnlyCorrectType', async () => {
      await withTransaction(async () => {
        await emptyCtx.useLockWithAcquire(BATTLE_LOCK, async (battleCtx) => {
          // === Phase 1: Setup user with both weapon types ===
          let attackerId = 0;
          await battleCtx.useLockWithAcquire(USER_LOCK, async (userCtx) => {
            const attacker = (await userCache.getUserByUsername(userCtx, 'a'))!;
            attackerId = attacker.id;

            // Give attacker both projectile and energy weapons
            attacker.techCounts.auto_turret = 1;
            attacker.techCounts.pulse_laser = 1;
            
            // Upgrade only projectile reload rate to level 2
            attacker.techTree.projectileReloadRate = 2;
            // Keep energy at level 1 (default)
            attacker.techTree.energyRechargeRate = 1;
            userCache.updateUserInCache(userCtx, attacker);
          });

          // === Phase 2: Calculate expected reload times ===
          await battleCtx.useLockWithAcquire(USER_LOCK, async (userCtx) => {
            const attacker = (await userCache.getUserByUsername(userCtx, 'a'))!;
            
            // Projectile: level 2 = 20% faster = 0.8x
            // auto_turret: 3s * 0.8 = 2.4s
            const projectileReload = TechFactory.calculateWeaponReloadTime('auto_turret', attacker.techTree);
            expect(projectileReload).toBeCloseTo(2.4, 1);
            
            // Energy: level 1 = 15% faster = 0.85x
            // pulse_laser: 2s * 0.85 = 1.7s
            const energyReload = TechFactory.calculateWeaponReloadTime('pulse_laser', attacker.techTree);
            expect(energyReload).toBeCloseTo(1.7, 1);
            
            // Verify they're different (research only affected projectile)
            expect(Math.abs(projectileReload - energyReload)).toBeGreaterThan(0.5);
          });
        });
      });
    });
  });
});
