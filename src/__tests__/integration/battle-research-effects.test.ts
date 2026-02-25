// ---
// Battle Research Effects Integration Test
// Verifies that research upgrades affect weapon reload times in battles
// ---

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BattleCache, getBattleCache } from '../../lib/server/battle/BattleCache';
import { UserCache } from '../../lib/server/user/userCache';
import { TechFactory } from '../../lib/server/techs/TechFactory';
import { getWeaponDamageModifierFromTree, getWeaponAccuracyModifierFromTree } from '../../lib/server/techs/techtree';
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
            // auto_turret: 12min * 60 = 720s base, * 0.9 = 648s
            const initialReloadTime = TechFactory.calculateWeaponReloadTime('auto_turret', attacker.techTree);
            expect(initialReloadTime).toBeCloseTo(648, 1);
          });

          // === Phase 2: Upgrade research and recalculate ===
          await battleCtx.useLockWithAcquire(USER_LOCK, async (userCtx) => {
            const attacker = (await userCache.getUserByUsername(userCtx, 'a'))!;
            
            // Upgrade projectile reload rate research to level 3
            // Level 3 = 10 + 10 + 10 = 30% faster = 0.7x multiplier
            attacker.techTree.projectileReloadRate = 3;
            userCache.updateUserInCache(userCtx, attacker);

            // Recalculate reload time with upgraded research
            // auto_turret: 720s base * 0.7 = 504s
            const upgradedReloadTime = TechFactory.calculateWeaponReloadTime('auto_turret', attacker.techTree);
            expect(upgradedReloadTime).toBeCloseTo(504, 1);
          });

          // === Phase 3: Create battle with upgraded research ===
          const battle = await battleCtx.useLockWithAcquire(USER_LOCK, async (userCtx) => {
            const attacker = (await userCache.getUserByUsername(userCtx, 'a'))!;
            //const defender = (await userCache.getUserByUsername(userCtx, 'dummy'))!;

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
          
          // The cooldown in battle stats should be ~504 seconds (with level 3 research)
          const battleCooldown = battle.attackerStartStats.weapons.auto_turret.cooldown;
          expect(battleCooldown).toBeCloseTo(504, 1);
          
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
            // pulse_laser: 12min * 60 = 720s base, * 0.4 = 288s
            const upgradedReloadTime = TechFactory.calculateWeaponReloadTime('pulse_laser', attacker.techTree);
            expect(upgradedReloadTime).toBeCloseTo(288, 1);
          });

          // === Phase 2: Create battle and verify cooldowns ===
          const battle = await battleCtx.useLockWithAcquire(USER_LOCK, async (userCtx) => {
            const attacker = (await userCache.getUserByUsername(userCtx, 'a'))!;
            //const defender = (await userCache.getUserByUsername(userCtx, 'dummy'))!;

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
          
          // The cooldown in battle stats should be ~288 seconds (with level 4 research)
          const battleCooldown = battle.attackerStartStats.weapons.pulse_laser.cooldown;
          expect(battleCooldown).toBeCloseTo(288, 1);
          
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
          await battleCtx.useLockWithAcquire(USER_LOCK, async (userCtx) => {
            const attacker = (await userCache.getUserByUsername(userCtx, 'a'))!;

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
            // auto_turret: 720s * 0.8 = 576s
            const projectileReload = TechFactory.calculateWeaponReloadTime('auto_turret', attacker.techTree);
            expect(projectileReload).toBeCloseTo(576, 1);
            
            // Energy: level 1 = 15% faster = 0.85x
            // pulse_laser: 720s * 0.85 = 612s
            const energyReload = TechFactory.calculateWeaponReloadTime('pulse_laser', attacker.techTree);
            expect(energyReload).toBeCloseTo(612, 1);
            
            // Verify they're different (research only affected projectile)
            expect(Math.abs(projectileReload - energyReload)).toBeGreaterThan(0.5);
          });
        });
      });
    });
  });

  describe('Research Effects on Battle Damage', () => {
    it('damageResearch_projectileWeaponAtLevel2_increases15Percent', async () => {
      await withTransaction(async () => {
        await emptyCtx.useLockWithAcquire(USER_LOCK, async (userCtx) => {
          const attacker = (await userCache.getUserByUsername(userCtx, 'a'))!;

          // Set projectile damage research to level 1 (default base)
          attacker.techTree.projectileDamage = 1;
          userCache.updateUserInCache(userCtx, attacker);

          // At level 1, modifier should be 1.0 (100%, no bonus)
          const baseDamageModifier = getWeaponDamageModifierFromTree(attacker.techTree, 'auto_turret');
          expect(baseDamageModifier).toBeCloseTo(1.0);

          // Upgrade to level 2
          attacker.techTree.projectileDamage = 2;
          userCache.updateUserInCache(userCtx, attacker);

          // At level 2, modifier should be 1.15 (115%, +15% damage)
          const upgradedDamageModifier = getWeaponDamageModifierFromTree(attacker.techTree, 'auto_turret');
          expect(upgradedDamageModifier).toBeCloseTo(1.15);

          // Verify damage calculation reflects the modifier
          // auto_turret with 1 weapon, no shields/armor, spread=1.0
          const baseCalc = TechFactory.calculateWeaponDamage(
            'auto_turret',
            attacker.techCounts,
            0, 0, 0, 0, baseDamageModifier, 0, 1.0
          );
          const upgradedCalc = TechFactory.calculateWeaponDamage(
            'auto_turret',
            attacker.techCounts,
            0, 0, 0, 0, upgradedDamageModifier, 0, 1.0
          );

          // Upgraded damage should be greater than base damage
          const totalBase = baseCalc.shieldDamage + baseCalc.armorDamage + baseCalc.hullDamage;
          const totalUpgraded = upgradedCalc.shieldDamage + upgradedCalc.armorDamage + upgradedCalc.hullDamage;
          expect(totalUpgraded).toBeGreaterThan(totalBase);
          // Allow for rounding from Math.round() in TechFactory
          expect(totalUpgraded / totalBase).toBeCloseTo(1.15, 0);
        });
      });
    });

    it('damageResearch_energyWeaponAtLevel3_increases3225Percent', async () => {
      await withTransaction(async () => {
        await emptyCtx.useLockWithAcquire(USER_LOCK, async (userCtx) => {
          const attacker = (await userCache.getUserByUsername(userCtx, 'a'))!;

          // Ensure attacker has a pulse_laser
          attacker.techCounts.pulse_laser = 1;

          // At level 1, energy damage modifier should be 1.0
          attacker.techTree.energyDamage = 1;
          const baseDamageModifier = getWeaponDamageModifierFromTree(attacker.techTree, 'pulse_laser');
          expect(baseDamageModifier).toBeCloseTo(1.0);

          // At level 3, energy damage: 60 * 1.15^2 = 79.35, modifier = 79.35/60 = 1.3225
          attacker.techTree.energyDamage = 3;
          const upgradedDamageModifier = getWeaponDamageModifierFromTree(attacker.techTree, 'pulse_laser');
          expect(upgradedDamageModifier).toBeCloseTo(1.3225);

          // Verify damage calculation uses the modifier
          const baseCalc = TechFactory.calculateWeaponDamage(
            'pulse_laser',
            attacker.techCounts,
            0, 0, 0, 0, baseDamageModifier, 0, 1.0
          );
          const upgradedCalc = TechFactory.calculateWeaponDamage(
            'pulse_laser',
            attacker.techCounts,
            0, 0, 0, 0, upgradedDamageModifier, 0, 1.0
          );

          const totalBase = baseCalc.shieldDamage + baseCalc.armorDamage + baseCalc.hullDamage;
          const totalUpgraded = upgradedCalc.shieldDamage + upgradedCalc.armorDamage + upgradedCalc.hullDamage;
          expect(totalUpgraded).toBeGreaterThan(totalBase);
        });
      });
    });

    it('damageResearch_affectsOnlyCorrectWeaponType', async () => {
      await withTransaction(async () => {
        await emptyCtx.useLockWithAcquire(USER_LOCK, async (userCtx) => {
          const attacker = (await userCache.getUserByUsername(userCtx, 'a'))!;

          // Upgrade only projectile damage to level 2
          attacker.techTree.projectileDamage = 2;
          attacker.techTree.energyDamage = 1;
          userCache.updateUserInCache(userCtx, attacker);

          const projectileDmgModifier = getWeaponDamageModifierFromTree(attacker.techTree, 'auto_turret');
          const energyDmgModifier = getWeaponDamageModifierFromTree(attacker.techTree, 'pulse_laser');

          // Projectile should be boosted, energy should be at base
          expect(projectileDmgModifier).toBeCloseTo(1.15);
          expect(energyDmgModifier).toBeCloseTo(1.0);
        });
      });
    });
  });

  describe('Research Effects on Battle Accuracy', () => {
    it('accuracyResearch_projectileWeaponAtLevel1_returns0Bonus', async () => {
      await withTransaction(async () => {
        await emptyCtx.useLockWithAcquire(USER_LOCK, async (userCtx) => {
          const attacker = (await userCache.getUserByUsername(userCtx, 'a'))!;

          // At default level 1, accuracy modifier should be 0 (no bonus)
          attacker.techTree.projectileAccuracy = 1;
          const accuracyModifier = getWeaponAccuracyModifierFromTree(attacker.techTree, 'auto_turret');
          expect(accuracyModifier).toBeCloseTo(0);
        });
      });
    });

    it('accuracyResearch_projectileWeaponAtLevel2_increasesAccuracyBonus', async () => {
      await withTransaction(async () => {
        await emptyCtx.useLockWithAcquire(USER_LOCK, async (userCtx) => {
          const attacker = (await userCache.getUserByUsername(userCtx, 'a'))!;

          // At level 1, accuracy modifier should be 0
          attacker.techTree.projectileAccuracy = 1;
          const baseAccuracyModifier = getWeaponAccuracyModifierFromTree(attacker.techTree, 'auto_turret');
          expect(baseAccuracyModifier).toBeCloseTo(0);

          // At level 2, accuracy modifier should be ~4.92 (74.92 - 70)
          attacker.techTree.projectileAccuracy = 2;
          const upgradedAccuracyModifier = getWeaponAccuracyModifierFromTree(attacker.techTree, 'auto_turret');
          expect(upgradedAccuracyModifier).toBeCloseTo(4.92, 1);

          // Verify higher accuracy leads to more hits
          attacker.techCounts.auto_turret = 10;
          const baseCalc = TechFactory.calculateWeaponDamage(
            'auto_turret',
            attacker.techCounts,
            0, 0, baseAccuracyModifier, 0, 1.0, 0, 1.0
          );
          const upgradedCalc = TechFactory.calculateWeaponDamage(
            'auto_turret',
            attacker.techCounts,
            0, 0, upgradedAccuracyModifier, 0, 1.0, 0, 1.0
          );

          // More weapons should hit with upgraded accuracy
          expect(upgradedCalc.weaponsHit).toBeGreaterThanOrEqual(baseCalc.weaponsHit);
        });
      });
    });

    it('accuracyResearch_energyWeaponAtLevel2_increasesAccuracyBonus', async () => {
      await withTransaction(async () => {
        await emptyCtx.useLockWithAcquire(USER_LOCK, async (userCtx) => {
          const attacker = (await userCache.getUserByUsername(userCtx, 'a'))!;

          // At level 1, energy accuracy modifier should be 0
          attacker.techTree.energyAccuracy = 1;
          const baseAccuracyModifier = getWeaponAccuracyModifierFromTree(attacker.techTree, 'pulse_laser');
          expect(baseAccuracyModifier).toBeCloseTo(0);

          // At level 2, energy accuracy effect = 65 * polynomial(0.1, 2) ~ 69.57
          // Bonus = 69.57 - 65 = ~4.57
          attacker.techTree.energyAccuracy = 2;
          const upgradedAccuracyModifier = getWeaponAccuracyModifierFromTree(attacker.techTree, 'pulse_laser');
          expect(upgradedAccuracyModifier).toBeGreaterThan(0);
        });
      });
    });

    it('accuracyResearch_affectsOnlyCorrectWeaponType', async () => {
      await withTransaction(async () => {
        await emptyCtx.useLockWithAcquire(USER_LOCK, async (userCtx) => {
          const attacker = (await userCache.getUserByUsername(userCtx, 'a'))!;

          // Upgrade only projectile accuracy to level 2
          attacker.techTree.projectileAccuracy = 2;
          attacker.techTree.energyAccuracy = 1;
          userCache.updateUserInCache(userCtx, attacker);

          const projectileAccuracyModifier = getWeaponAccuracyModifierFromTree(attacker.techTree, 'auto_turret');
          const energyAccuracyModifier = getWeaponAccuracyModifierFromTree(attacker.techTree, 'pulse_laser');

          // Projectile should have a bonus, energy should have none
          expect(projectileAccuracyModifier).toBeGreaterThan(0);
          expect(energyAccuracyModifier).toBeCloseTo(0);
        });
      });
    });
  });
});
