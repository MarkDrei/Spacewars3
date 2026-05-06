import { describe, expect, test, beforeEach, vi } from 'vitest';
import { createLockContext } from '@markdrei/ironguard-typescript-locks';
import { USER_LOCK } from '@/lib/server/typedLocks';
import { User, SaveUserCallback } from '@/lib/server/user/user';
import {
  ResearchType,
  triggerResearch,
  getResearchEffectFromTree,
  createInitialTechTree,
} from '@/lib/server/techs/techtree';
import { TechService } from '@/lib/server/techs/TechService';
import { TechCounts } from '@/lib/server/techs/TechFactory';
import { UserBonuses } from '@/lib/server/bonus/userBonusTypes';
import { updateStatsWithMockedBuildRefresh, withUserLock } from '@/__tests__/helpers/updateStatsTestHelpers';

// The original integration version of this file exercised pure `User` logic
// without touching the database.  All of those tests have been promoted to
// unit tests here; the integration copy is now removed.

// simple defaults used by most tests
const DUMMY_SAVE: SaveUserCallback = async () => {};
const DEFAULT_TECH_COUNTS: TechCounts = {
  pulse_laser: 0,
  auto_turret: 0,
  plasma_lance: 0,
  gauss_rifle: 0,
  photon_torpedo: 0,
  rocket_launcher: 0,
  ship_hull: 0,
  kinetic_armor: 0,
  energy_shield: 0,
  missile_jammer: 0,
};

function makeUser(shipSpeedLevel = 1): User {
  const tree = createInitialTechTree();
  tree.shipSpeed = shipSpeedLevel;
  return new User(
    1,
    'u',
    'h',
    0,
    0,
    1000,
    tree,
    DUMMY_SAVE,
    DEFAULT_TECH_COUNTS,
    100,
    100,
    100,
    1000,
    false,
    null,
    [],
    null,
    0,
    0
  );
}

function makeBonuses(overrides: Partial<UserBonuses>): UserBonuses {
  // provide minimum required fields and allow overriding only maxShipSpeed
  const base: UserBonuses = {
    levelMultiplier: 1,
    commanderMultipliers: {
      shipSpeed: 1,
      energyWeaponDamage: 1,
      energyWeaponReloadRate: 1,
      energyWeaponAccuracy: 1,
      projectileWeaponDamage: 1,
      projectileWeaponReloadRate: 1,
      projectileWeaponAccuracy: 1,
    },
    ironStorageCapacity: 0,
    ironRechargeRate: 0,
    repairRate: 0,
    shieldRechargeRate: 0,
    maxShipSpeed: 0,
    constructionSpeedFactor: 1,
    researchSpeedFactor: 1,
    projectileWeaponDamageFactor: 0,
    projectileWeaponReloadFactor: 0,
    projectileWeaponAccuracyFactor: 0,
    energyWeaponDamageFactor: 0,
    energyWeaponReloadFactor: 0,
    energyWeaponAccuracyFactor: 0,
  };
  return { ...base, ...overrides };
}

// =============================================================================
// Ship Speed Tests
// =============================================================================

describe('User ship speed helpers', () => {
  test('getMaxShipSpeed_returnsResearchEffect', () => {
    const user = makeUser(1);
    // raw research effect via helper
    const base = getResearchEffectFromTree(user.techTree, ResearchType.ShipSpeed);
    expect(base).toBe(25);
    user.techTree.shipSpeed = 3;
    const base2 = getResearchEffectFromTree(user.techTree, ResearchType.ShipSpeed);
    expect(base2).toBeCloseTo(35, 5);
  });

  test('getMaxShipSpeed_initialTechTree_returnsBaseSpeed', () => {
    const user = makeUser(1);
    const bonuses = makeBonuses({
      maxShipSpeed: getResearchEffectFromTree(user.techTree, ResearchType.ShipSpeed),
    });
    expect(user.getMaxShipSpeed(bonuses)).toBe(25); // base value for level 1
  });

  test('getMaxShipSpeed_aftershipSpeedUpgrade_returnsImprovedSpeed', () => {
    const user = makeUser(1);
    user.techTree.shipSpeed = 2;
    const bonuses = makeBonuses({
      maxShipSpeed: getResearchEffectFromTree(user.techTree, ResearchType.ShipSpeed),
    });
    expect(user.getMaxShipSpeed(bonuses)).toBeCloseTo(30, 5);
  });

  test('getMaxShipSpeed_afterMultipleshipSpeedUpgrades_returnsCorrectIncreasedSpeed', () => {
    const user = makeUser(1);
    user.techTree.shipSpeed = 4;
    const bonuses = makeBonuses({
      maxShipSpeed: getResearchEffectFromTree(user.techTree, ResearchType.ShipSpeed),
    });
    expect(user.getMaxShipSpeed(bonuses)).toBeCloseTo(40, 5);
  });

  test('getMaxShipSpeed_independentOfIronHarvestingLevel_onlyDependsOnshipSpeed', () => {
    const user = makeUser(1);
    // upgrade iron harvesting but not ship speed
    user.techTree.ironHarvesting = 5;
    let bonuses = makeBonuses({
      maxShipSpeed: getResearchEffectFromTree(user.techTree, ResearchType.ShipSpeed),
    });
    expect(user.getMaxShipSpeed(bonuses)).toBe(25);

    // now upgrade ship speed
    user.techTree.shipSpeed = 2;
    bonuses = makeBonuses({
      maxShipSpeed: getResearchEffectFromTree(user.techTree, ResearchType.ShipSpeed),
    });
    expect(user.getMaxShipSpeed(bonuses)).toBeCloseTo(30, 5);
  });

  test('getMaxShipSpeedWithBonuses_usesBonusValue', () => {
    const user = makeUser(2);
    const bonusValue = 99;
    const bonuses = makeBonuses({ maxShipSpeed: bonusValue });
    expect(user.getMaxShipSpeed(bonuses)).toBe(bonusValue);
  });

  test('getCurrentMaxShipSpeed_withoutBonuses_matchesBase', () => {
    const user = makeUser(2);
    const speed = getResearchEffectFromTree(user.techTree, ResearchType.ShipSpeed);
    const bonuses = makeBonuses({ maxShipSpeed: speed });
    expect(user.getCurrentMaxShipSpeed(bonuses)).toBe(speed);
  });

  test('getCurrentMaxShipSpeed_withBonuses_usesBonuses', () => {
    const user = makeUser(2);
    const bonusValue = 123;
    const bonuses = makeBonuses({ maxShipSpeed: bonusValue });
    expect(user.getCurrentMaxShipSpeed(bonuses)).toBe(bonusValue);
  });

  test('getCurrentMaxShipSpeedWithContext_fetchesBonuses', async () => {
    const user = makeUser(2);
    // spy on cache to return a known bonuses object
    const fakeBonuses = makeBonuses({ maxShipSpeed: 77 });
    const spy = vi.spyOn(user.bonusCache, 'getBonuses').mockResolvedValue(fakeBonuses);
    const ctx = createLockContext();

    await ctx.useLockWithAcquire(USER_LOCK, async (userCtx) => {
      const result = await user.getCurrentMaxShipSpeedWithContext(userCtx);
      expect(result).toBe(77);
      expect(spy).toHaveBeenCalledWith(userCtx, 1);
    });

    spy.mockRestore();
  });
});

// =============================================================================
// Update Stats Tests
// =============================================================================

describe('User.updateStats with IronHarvesting research progression', () => {
  let user: User;
  const dummySave: SaveUserCallback = async () => {
    /* no-op for testing */
  };

  beforeEach(() => {
    const defaultTechCounts = {
      pulse_laser: 5,
      auto_turret: 5,
      plasma_lance: 0,
      gauss_rifle: 0,
      photon_torpedo: 0,
      rocket_launcher: 0,
      ship_hull: 5,
      kinetic_armor: 5,
      energy_shield: 5,
      missile_jammer: 0,
    };
    user = new User(
      1,
      'testuser',
      'hash',
      0,
      0, // xp
      1000,
      createInitialTechTree(),
      dummySave,
      defaultTechCounts,
      250, // hullCurrent
      250, // armorCurrent
      250, // shieldCurrent
      1000, // defenseLastRegen
      false, // inBattle
      null, // currentBattleId
      [], // buildQueue
      null, // buildStartSec
      0, // teleportCharges
      0 // teleportLastRegen
    );
  });

  async function updateStatsWithMockedBuildProcessing(
    now: number,
    implementation: (
      userId: number,
      context: unknown,
      options?: { now?: number }
    ) => Promise<{ completed: { itemKey: string; itemType: 'weapon' | 'defense'; completionTime: number }[] }>
  ) {
    const processCompletedBuilds = vi.fn().mockImplementation(implementation);
    const getInstanceSpy = vi.spyOn(TechService, 'getInstance').mockReturnValue({ processCompletedBuilds } as unknown as TechService);

    try {
      await withUserLock(async (context) => {
        await user.updateStats(now, context);
      });
    } finally {
      getInstanceSpy.mockRestore();
    }

    return processCompletedBuilds;
  }

  test('updateStats_researchDoesNotComplete_awardsAllIronAtOldRate', async () => {
    // Start IronHarvesting research (duration 10s)
    triggerResearch(user.techTree, ResearchType.IronHarvesting);
    // Only 5s pass, research not done
    await updateStatsWithMockedBuildRefresh(user, 1005);
    expect(user.iron).toBeCloseTo(5); // 1 iron/sec * 5s
    expect(user.techTree.ironHarvesting).toBe(1); // not upgraded yet
    expect(user.techTree.activeResearch).toBeDefined();
  });

  test('updateStats_researchCompletesDuringInterval_splitsIronGain', async () => {
    // Start IronHarvesting research (duration 10s)
    triggerResearch(user.techTree, ResearchType.IronHarvesting);
    // 15s pass, research completes at t+10, then 5s at new rate
    await updateStatsWithMockedBuildRefresh(user, 1015);
    expect(user.iron).toBeCloseTo(10 + 5 * 1.11, 5);
    expect(user.techTree.ironHarvesting).toBe(2); // upgraded
    expect(user.techTree.activeResearch).toBeUndefined();
  });

  test('updateStats_researchAlreadyDueAtIntervalStart_completesImmediatelyWithoutLooping', async () => {
    triggerResearch(user.techTree, ResearchType.IronHarvesting);
    expect(user.techTree.activeResearch).toBeDefined();

    user.techTree.activeResearch!.remainingDuration = 0;

    await updateStatsWithMockedBuildRefresh(user, 1005);

    expect(user.techTree.ironHarvesting).toBe(2);
    expect(user.techTree.activeResearch).toBeUndefined();
    expect(user.iron).toBeCloseTo(5 * 1.11, 5);
  });

  test('updateStats_multipleResearchCompletionsAndFurtherResearch0_correctIronAndResearchState', async () => {
    // Start IronHarvesting research (duration 10s)
    triggerResearch(user.techTree, ResearchType.IronHarvesting);
    // Complete first research in 10s, then immediately start another
    await updateStatsWithMockedBuildRefresh(user, 1010);
    expect(user.iron).toBeCloseTo(10);
    expect(user.techTree.ironHarvesting).toBe(2);
    expect(user.techTree.activeResearch).toBeUndefined();
    // Start another research
    triggerResearch(user.techTree, ResearchType.IronHarvesting);
    // verify remaining duration is correct
    expect(user.techTree.activeResearch).toBeDefined();
    expect(user.techTree.activeResearch?.type).toBe(ResearchType.IronHarvesting);
    expect(user.techTree.activeResearch?.remainingDuration).toBe(20); // 20s for next level
    // 15s pass: 15s at 1.11/sec (research in progress)
    await updateStatsWithMockedBuildRefresh(user, 1025);
    expect(user.iron).toBeCloseTo(10 + 15 * 1.11, 5);
    expect(user.techTree.ironHarvesting).toBe(2);
    await updateStatsWithMockedBuildRefresh(user, 1030); // complete the second research
    expect(user.iron).toBeCloseTo(10 + 20 * 1.11, 5);
    expect(user.techTree.ironHarvesting).toBe(3); // upgraded to level 3
    expect(user.techTree.activeResearch).toBeUndefined();
  });

  test('updateStats_multipleResearchCompletionsAndFurtherResearch_correctIronAndResearchState', async () => {
    // Start IronHarvesting research (duration 10s)
    triggerResearch(user.techTree, ResearchType.IronHarvesting);
    // Complete first research in 10s, then immediately start another
    await updateStatsWithMockedBuildRefresh(user, 1010);
    expect(user.iron).toBeCloseTo(10);
    expect(user.techTree.ironHarvesting).toBe(2);
    expect(user.techTree.activeResearch).toBeUndefined();
    // Start another research
    triggerResearch(user.techTree, ResearchType.IronHarvesting);
    // 30s pass: 20s at 1.11/sec (research in progress), 10s at 1.24/sec (after upgrade)
    await updateStatsWithMockedBuildRefresh(user, 1040);
    expect(user.iron).toBeCloseTo(10 + 20 * 1.11 + 10 * 1.24, 5);
    expect(user.techTree.ironHarvesting).toBe(3);
    expect(user.techTree.activeResearch).toBeUndefined();
  });

  test('updateStats_threeConsecutiveIronHarvestingUpgrades_correctScalingAndIronGain', async () => {
    // Start first IronHarvesting research (duration 10s)
    triggerResearch(user.techTree, ResearchType.IronHarvesting);
    // Complete first research in 10s, then immediately start another
    await updateStatsWithMockedBuildRefresh(user, 1010);
    expect(user.iron).toBeCloseTo(10); // 10s at 1/sec
    expect(user.techTree.ironHarvesting).toBe(2);
    expect(user.techTree.activeResearch).toBeUndefined();
    // Start second research (duration 20s)
    triggerResearch(user.techTree, ResearchType.IronHarvesting);
    // Complete second research in 20s, then immediately start another
    await updateStatsWithMockedBuildRefresh(user, 1030);
    expect(user.iron).toBeCloseTo(10 + 20 * 1.11, 5);
    expect(user.techTree.ironHarvesting).toBe(3);
    expect(user.techTree.activeResearch).toBeUndefined();
    // Start third research (duration 40s)
    triggerResearch(user.techTree, ResearchType.IronHarvesting);
    // Complete third research in 40s
    await updateStatsWithMockedBuildRefresh(user, 1070);
    expect(user.iron).toBeCloseTo(10 + 20 * 1.11 + 40 * 1.24, 5);
    expect(user.techTree.ironHarvesting).toBe(4);
    expect(user.techTree.activeResearch).toBeUndefined();
  });

  test('updateStats_fourConsecutiveIronHarvestingUpgradesOddDurationsAndRates_correctIronAndResearchState', async () => {
    // Start first IronHarvesting research (duration 10s)
    triggerResearch(user.techTree, ResearchType.IronHarvesting);
    await updateStatsWithMockedBuildRefresh(user, 1007); // 7s pass, research not done
    expect(user.iron).toBeCloseTo(7); // 7s at 1/sec
    expect(user.techTree.ironHarvesting).toBe(1);
    expect(user.techTree.activeResearch).toBeDefined();
    await updateStatsWithMockedBuildRefresh(user, 1010); // 3s pass, research completes
    expect(user.iron).toBeCloseTo(10); // 3s at 1/sec
    expect(user.techTree.ironHarvesting).toBe(2);
    expect(user.techTree.activeResearch).toBeUndefined();
    // Start second research (duration 20s)
    triggerResearch(user.techTree, ResearchType.IronHarvesting);
    await updateStatsWithMockedBuildRefresh(user, 1022); // 12s pass, research not done
    expect(user.iron).toBeCloseTo(10 + 12 * 1.11, 5);
    expect(user.techTree.ironHarvesting).toBe(2);
    expect(user.techTree.activeResearch).toBeDefined();
    await updateStatsWithMockedBuildRefresh(user, 1030); // 8s pass, research completes
    expect(user.iron).toBeCloseTo(10 + 20 * 1.11, 5);
    expect(user.techTree.ironHarvesting).toBe(3);
    expect(user.techTree.activeResearch).toBeUndefined();
    // Start third research (duration 40s)
    triggerResearch(user.techTree, ResearchType.IronHarvesting);
    await updateStatsWithMockedBuildRefresh(user, 1050); // 20s pass, research not done
    expect(user.iron).toBeCloseTo(10 + 20 * 1.11 + 20 * 1.24, 5);
    expect(user.techTree.ironHarvesting).toBe(3);
    expect(user.techTree.activeResearch).toBeDefined();
    await updateStatsWithMockedBuildRefresh(user, 1070); // 20s pass, research completes
    expect(user.iron).toBeCloseTo(10 + 20 * 1.11 + 40 * 1.24, 5);
    expect(user.techTree.ironHarvesting).toBe(4);
    expect(user.techTree.activeResearch).toBeUndefined();
    // Start fourth research (duration 80s)
    triggerResearch(user.techTree, ResearchType.IronHarvesting);
    await updateStatsWithMockedBuildRefresh(user, 1110); // 40s pass, research not done
    expect(user.iron).toBeCloseTo(10 + 20 * 1.11 + 40 * 1.24 + 40 * 1.39, 5);
    expect(user.techTree.ironHarvesting).toBe(4);
    expect(user.techTree.activeResearch).toBeDefined();
    await updateStatsWithMockedBuildRefresh(user, 1150); // 40s pass, research completes
    expect(user.iron).toBeCloseTo(10 + 20 * 1.11 + 40 * 1.24 + 80 * 1.39, 5);
    expect(user.techTree.ironHarvesting).toBe(5);
    expect(user.techTree.activeResearch).toBeUndefined();
  });

  test('updateStats_researchAlreadyCompleted_awardsAllIronAtNewRate', async () => {
    // Manually upgrade
    user.techTree.ironHarvesting = 2;
    await updateStatsWithMockedBuildRefresh(user, 1010);
    expect(user.iron).toBeCloseTo(10 * getResearchEffectFromTree(user.techTree, ResearchType.IronHarvesting));
  });

  test('updateStats_nonIronHarvestingResearch_awardsAllIronAtOldRate', async () => {
    // Start shipSpeed research (does not affect iron)
    triggerResearch(user.techTree, ResearchType.ShipSpeed);
    await updateStatsWithMockedBuildRefresh(user, 1010);
    expect(user.iron).toBeCloseTo(10);
    expect(user.techTree.activeResearch).toBeDefined();
  });

  test('updateStats_buildCompletesDuringInterval_awardsIronBeforeQueueAbortEvent', async () => {
    user.iron = 0;
    user.last_updated = 1000;
    user.buildQueue = [
      { itemKey: 'auto_turret', itemType: 'weapon', completionTime: 0 },
      { itemKey: 'auto_turret', itemType: 'weapon', completionTime: 0 }
    ];
    user.buildStartSec = 1000;

    const processCompletedBuilds = await updateStatsWithMockedBuildProcessing(1150, async (_userId, _context, options?: { now?: number }) => {
      if (options?.now !== 1060) {
        throw new Error(`Unexpected build processing time: ${options?.now}`);
      }

      expect(user.iron).toBeCloseTo(60);

      user.techCounts.auto_turret += 1;
      user.buildQueue = [];
      user.buildStartSec = null;

      return {
        completed: [{ itemKey: 'auto_turret', itemType: 'weapon', completionTime: 1060 }]
      };
    });

    expect(processCompletedBuilds).toHaveBeenCalledTimes(1);
    expect(user.iron).toBeCloseTo(150);
    expect(user.buildQueue).toEqual([]);
    expect(user.last_updated).toBe(1150);
  });

  test('updateStats_buildCompletesDuringInterval_spendsOnlyIronAvailableAtBuildEvent', async () => {
    user.iron = 50;
    user.last_updated = 1000;
    user.buildQueue = [
      { itemKey: 'auto_turret', itemType: 'weapon', completionTime: 0 },
      { itemKey: 'auto_turret', itemType: 'weapon', completionTime: 0 }
    ];
    user.buildStartSec = 1000;

    const processCompletedBuilds = await updateStatsWithMockedBuildProcessing(1150, async (_userId, _context, options?: { now?: number }) => {
      if (options?.now === 1060) {
        expect(user.iron).toBeCloseTo(110);

        user.techCounts.auto_turret += 1;
        user.iron -= 100;
        user.buildQueue = [{ itemKey: 'auto_turret', itemType: 'weapon', completionTime: 0 }];
        user.buildStartSec = 1060;

        return {
          completed: [{ itemKey: 'auto_turret', itemType: 'weapon', completionTime: 1060 }]
        };
      }

      if (options?.now === 1120) {
        expect(user.iron).toBeCloseTo(70);

        user.techCounts.auto_turret += 1;
        user.buildQueue = [];
        user.buildStartSec = null;

        return {
          completed: [{ itemKey: 'auto_turret', itemType: 'weapon', completionTime: 1120 }]
        };
      }

      throw new Error(`Unexpected build processing time: ${options?.now}`);
    });

    expect(processCompletedBuilds).toHaveBeenCalledTimes(2);
    expect(user.iron).toBeCloseTo(100);
    expect(user.buildQueue).toEqual([]);
    expect(user.buildStartSec).toBeNull();
    expect(user.last_updated).toBe(1150);
  });

  test('updateStats_alsoUpdatesDefenseValues_regeneratesCorrectly', async () => {
    // User starts with partial defense values (250 each, max 500)
    expect(user.hullCurrent).toBe(250);
    expect(user.armorCurrent).toBe(250);
    expect(user.shieldCurrent).toBe(250);
    expect(user.defenseLastRegen).toBe(1000);
  });

  test('updateStats_defenseRegenClamped_stopsAtMax', async () => {
    // User starts with partial defense values (close to max)
    user.hullCurrent = 740;
    user.armorCurrent = 1240;
    user.shieldCurrent = 1240;

    // 20 seconds pass (would regenerate 20 points, but max is 500)
    await updateStatsWithMockedBuildRefresh(user, 1020);

    // Defense values should be clamped at max
    expect(user.hullCurrent).toBeCloseTo(741, 5);
    expect(user.armorCurrent).toBeCloseTo(1241, 5);
    expect(user.shieldCurrent).toBeCloseTo(1242, 5);
    expect(user.defenseLastRegen).toBe(1020);
  });
});

// =============================================================================
// Getter Methods & Defense Regeneration Tests
// =============================================================================

// These cover various getter methods not exercised by updateStats tests, plus a
// full suite of regeneration scenarios for `updateDefenseValues`.  Ship speed
// tests are covered in the ship speed helpers section above.

describe('User getter methods', () => {
  let user: User;
  const dummySave: SaveUserCallback = async () => {
    /* no-op for testing */
  };

  beforeEach(() => {
    const defaultTechCounts = {
      pulse_laser: 5,
      auto_turret: 5,
      plasma_lance: 0,
      gauss_rifle: 0,
      photon_torpedo: 0,
      rocket_launcher: 0,
      ship_hull: 5,
      kinetic_armor: 5,
      energy_shield: 5,
      missile_jammer: 0,
    };
    user = new User(
      1,
      'testuser',
      'hash',
      0,
      0, // xp
      1000,
      createInitialTechTree(),
      dummySave,
      defaultTechCounts,
      250, // hullCurrent
      250, // armorCurrent
      250, // shieldCurrent
      1000, // defenseLastRegen
      false, // inBattle
      null, // currentBattleId
      [], // buildQueue
      null, // buildStartSec
      0, // teleportCharges
      0 // teleportLastRegen
    );
  });

  test('getIronPerSecond_initialTechTree_returnsBaseRate', () => {
    const ironPerSecond = user.getIronPerSecond();
    expect(ironPerSecond).toBe(1); // Base iron harvesting rate
  });

  test('getIronPerSecond_afterIronHarvestingUpgrade_returnsImprovedRate', () => {
    // Manually upgrade iron harvesting to level 2
    user.techTree.ironHarvesting = 2;
    const ironPerSecond = user.getIronPerSecond();
    expect(ironPerSecond).toBeCloseTo(1.11, 5);
  });

  test('getIronPerSecond_afterMultipleIronHarvestingUpgrades_returnsCorrectScaledRate', () => {
    // Manually upgrade iron harvesting to level 3
    user.techTree.ironHarvesting = 3;
    const ironPerSecond = user.getIronPerSecond();
    expect(ironPerSecond).toBeCloseTo(1.24, 5);
  });
});

// the regeneration tests were originally grouped separately in the snippet
// provided by the user.  they are kept in their own describe block so the
// setup (with sub‑max defense values) is distinct from the getters above.

describe('User.updateDefenseValues with regeneration', () => {
  let user: User;
  const dummySave: SaveUserCallback = async () => {
    /* no-op for testing */
  };

  beforeEach(() => {
    const defaultTechCounts = {
      pulse_laser: 5,
      auto_turret: 5,
      plasma_lance: 0,
      gauss_rifle: 0,
      photon_torpedo: 0,
      rocket_launcher: 0,
      ship_hull: 5,
      kinetic_armor: 5,
      energy_shield: 5,
      missile_jammer: 0,
    };
    user = new User(
      1,
      'testuser',
      'hash',
      0,
      0, // xp
      1000,
      createInitialTechTree(),
      dummySave,
      defaultTechCounts,
      100, // hullCurrent (below max)
      200, // armorCurrent (below max)
      300, // shieldCurrent (below max)
      1000, // defenseLastRegen
      false, // inBattle
      null, // currentBattleId
      [], // buildQueue
      null, // buildStartSec
      0, // teleportCharges
      0 // teleportLastRegen
    );
  });

  test('updateDefenseValues_elapsedTime_regeneratesCorrectly', () => {
    // 10 seconds elapsed, repair is split across hull and armor while shield recharges independently.
    user.updateDefenseValues(1010);

    expect(user.hullCurrent).toBeCloseTo(100.5, 5);
    expect(user.armorCurrent).toBeCloseTo(200.5, 5);
    expect(user.shieldCurrent).toBeCloseTo(301, 5);
    expect(user.defenseLastRegen).toBe(1010);
  });

  test('updateDefenseValues_regenClamping_stopsAtMax', () => {
    // Set current very close to max, then regenerate past max
    user.hullCurrent = 745; // max = 750 (5 techs × 150)
    user.armorCurrent = 1240; // max = 1250 (5 techs × 250)
    user.shieldCurrent = 1248; // max = 1250 (5 techs × 250)

    // 20 seconds elapsed, would add 20 points but should clamp at max
    user.updateDefenseValues(1020);

    expect(user.hullCurrent).toBeCloseTo(746, 5);
    expect(user.armorCurrent).toBeCloseTo(1241, 5);
    expect(user.shieldCurrent).toBe(1250); // clamped at max
    expect(user.defenseLastRegen).toBe(1020);
  });

  test('updateDefenseValues_noTime_noChange', () => {
    const initialHull = user.hullCurrent;
    const initialArmor = user.armorCurrent;
    const initialShield = user.shieldCurrent;

    // No time elapsed
    user.updateDefenseValues(1000);

    expect(user.hullCurrent).toBe(initialHull);
    expect(user.armorCurrent).toBe(initialArmor);
    expect(user.shieldCurrent).toBe(initialShield);
    expect(user.defenseLastRegen).toBe(1000);
  });

  test('updateDefenseValues_negativeTime_noChange', () => {
    const initialHull = user.hullCurrent;
    const initialArmor = user.armorCurrent;
    const initialShield = user.shieldCurrent;

    // Negative time elapsed (should not happen, but handle gracefully)
    user.updateDefenseValues(999);

    expect(user.hullCurrent).toBe(initialHull);
    expect(user.armorCurrent).toBe(initialArmor);
    expect(user.shieldCurrent).toBe(initialShield);
    expect(user.defenseLastRegen).toBe(1000); // unchanged
  });

  test('updateDefenseValues_alreadyAtMax_noChange', () => {
    user.hullCurrent = 750; // at max
    user.armorCurrent = 1250; // at max
    user.shieldCurrent = 1250; // at max

    // 10 seconds elapsed, but already at max
    user.updateDefenseValues(1010);

    expect(user.hullCurrent).toBe(750);
    expect(user.armorCurrent).toBe(1250);
    expect(user.shieldCurrent).toBe(1250);
    expect(user.defenseLastRegen).toBe(1010);
  });

  test('updateDefenseValues_largeTimeElapsed_regeneratesUpToMax', () => {
    user.hullCurrent = 100;
    user.armorCurrent = 200;
    user.shieldCurrent = 300;

    // 2000 seconds elapsed - the 0.1/s repair pool is still far from filling hull/armor,
    // while shield recharge advances independently.
    user.updateDefenseValues(3000);

    expect(user.hullCurrent).toBeCloseTo(200, 5);
    expect(user.armorCurrent).toBeCloseTo(300, 5);
    expect(user.shieldCurrent).toBeCloseTo(500, 5);
    expect(user.defenseLastRegen).toBe(3000);
  });

  test('updateDefenseValues_whenOneDefenseIsFull_repairOnlyAffectsRemainingDamagedDefense', () => {
    user.hullCurrent = 750;
    user.armorCurrent = 200;
    user.shieldCurrent = 300;

    user.updateDefenseValues(1010);

    expect(user.hullCurrent).toBe(750);
    expect(user.armorCurrent).toBeCloseTo(201, 5);
    expect(user.shieldCurrent).toBeCloseTo(301, 5);
  });

  test('updateDefenseValues_inBattle_disablesRepairButNotShieldRecharge', () => {
    user.hullCurrent = 100;
    user.armorCurrent = 200;
    user.shieldCurrent = 300;
    user.inBattle = true;

    user.updateDefenseValues(1010);

    expect(user.hullCurrent).toBe(100);
    expect(user.armorCurrent).toBe(200);
    expect(user.shieldCurrent).toBeCloseTo(301, 5);
  });
});
