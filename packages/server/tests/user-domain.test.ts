import { User, SaveUserCallback } from '../user';
import { TechTree, ResearchType, triggerResearch, getResearchEffectFromTree, createInitialTechTree, updateTechTree } from '../techtree';

describe('User.updateStats with IronHarvesting research progression', () => {
  let user: User;
  let saved: any;
  const dummySave: SaveUserCallback = async (u) => { saved = { ...u }; };

  beforeEach(() => {
    saved = null;
    user = new User(
      1,
      'testuser',
      'hash',
      0,
      1000,
      createInitialTechTree(),
      dummySave
    );
  });

  test('updateStats_researchDoesNotComplete_awardsAllIronAtOldRate', () => {
    // Start IronHarvesting research (duration 10s)
    triggerResearch(user.techTree, ResearchType.IronHarvesting);
    // Only 5s pass, research not done
    user.updateStats(1005);
    expect(user.iron).toBeCloseTo(5); // 1 iron/sec * 5s
    expect(user.techTree.ironHarvesting).toBe(1); // not upgraded yet
    expect(user.techTree.activeResearch).toBeDefined();
  });

  test('updateStats_researchCompletesDuringInterval_splitsIronGain', () => {
    // Start IronHarvesting research (duration 10s)
    triggerResearch(user.techTree, ResearchType.IronHarvesting);
    // 15s pass, research completes at t+10, then 5s at new rate
    user.updateStats(1015);
    // 10s at old rate (1/sec), 5s at new rate (1.1/sec)
    expect(user.iron).toBeCloseTo(10 + 5 * 1.1, 5);
    expect(user.techTree.ironHarvesting).toBe(2); // upgraded
    expect(user.techTree.activeResearch).toBeUndefined();
  });


  test('updateStats_multipleResearchCompletionsAndFurtherResearch0_correctIronAndResearchState', () => {
    // Start IronHarvesting research (duration 10s)
    triggerResearch(user.techTree, ResearchType.IronHarvesting);
    // Complete first research in 10s, then immediately start another
    user.updateStats(1010);
    expect(user.iron).toBeCloseTo(10);
    expect(user.techTree.ironHarvesting).toBe(2);
    expect(user.techTree.activeResearch).toBeUndefined();
    // Start another research
    triggerResearch(user.techTree, ResearchType.IronHarvesting);
    // verify remaining duration is correct
    expect(user.techTree.activeResearch).toBeDefined();
    expect(user.techTree.activeResearch?.type).toBe(ResearchType.IronHarvesting);
    expect(user.techTree.activeResearch?.remainingDuration).toBe(20); // 20s for next level
    // 15s pass: 15s at 1.1/sec (research in progress)
    user.updateStats(1025);
    // 15s at 1.1/sec (until research completes), 5s at 1.21/sec (after upgrade)
    expect(user.iron).toBeCloseTo(10 + 16.5, 5);
    expect(user.techTree.ironHarvesting).toBe(2);
    user.updateStats(1030); // complete the second research
    expect(user.iron).toBeCloseTo(10 + 16.5 + 5.5, 5); // 5s at 1.1/sec
    expect(user.techTree.ironHarvesting).toBe(3); // upgraded to level 3
    expect(user.techTree.activeResearch).toBeUndefined();
  });

  test('updateStats_multipleResearchCompletionsAndFurtherResearch_correctIronAndResearchState', () => {
    // Start IronHarvesting research (duration 10s)
    triggerResearch(user.techTree, ResearchType.IronHarvesting);
    // Complete first research in 10s, then immediately start another
    user.updateStats(1010);
    expect(user.iron).toBeCloseTo(10);
    expect(user.techTree.ironHarvesting).toBe(2);
    expect(user.techTree.activeResearch).toBeUndefined();
    // Start another research
    triggerResearch(user.techTree, ResearchType.IronHarvesting);
    // 30s pass: 20s at 1.1/sec (research in progress), 10s at 1.21/sec (after upgrade)
    user.updateStats(1040);
    // 20s at 1.1/sec (until research completes), 10s at 1.21/sec (after upgrade)
    expect(user.iron).toBeCloseTo(10 + 22 + 12.1, 5);
    expect(user.techTree.ironHarvesting).toBe(3);
    expect(user.techTree.activeResearch).toBeUndefined();
  });

  test('updateStats_threeConsecutiveIronHarvestingUpgrades_correctScalingAndIronGain', () => {
    // Start first IronHarvesting research (duration 10s)
    triggerResearch(user.techTree, ResearchType.IronHarvesting);
    // Complete first research in 10s, then immediately start another
    user.updateStats(1010);
    expect(user.iron).toBeCloseTo(10); // 10s at 1/sec
    expect(user.techTree.ironHarvesting).toBe(2);
    expect(user.techTree.activeResearch).toBeUndefined();
    // Start second research (duration 20s)
    triggerResearch(user.techTree, ResearchType.IronHarvesting);
    // Complete second research in 20s, then immediately start another
    user.updateStats(1030);
    expect(user.iron).toBeCloseTo(10 + 20 * 1.1, 5); // 10 at 1/sec, 20 at 1.1/sec
    expect(user.techTree.ironHarvesting).toBe(3);
    expect(user.techTree.activeResearch).toBeUndefined();
    // Start third research (duration 40s)
    triggerResearch(user.techTree, ResearchType.IronHarvesting);
    // Complete third research in 40s
    user.updateStats(1070);
    expect(user.iron).toBeCloseTo(10 + 22 + 40 * 1.21, 5); // 10 at 1/sec, 20 at 1.1/sec, 40 at 1.21/sec
    expect(user.techTree.ironHarvesting).toBe(4);
    expect(user.techTree.activeResearch).toBeUndefined();
  });

  test('updateStats_fourConsecutiveIronHarvestingUpgradesOddDurationsAndRates_correctIronAndResearchState', () => {
    // Start first IronHarvesting research (duration 10s)
    triggerResearch(user.techTree, ResearchType.IronHarvesting);
    user.updateStats(1007); // 7s pass, research not done
    expect(user.iron).toBeCloseTo(7); // 7s at 1/sec
    expect(user.techTree.ironHarvesting).toBe(1);
    expect(user.techTree.activeResearch).toBeDefined();
    user.updateStats(1010); // 3s pass, research completes
    expect(user.iron).toBeCloseTo(10); // 3s at 1/sec
    expect(user.techTree.ironHarvesting).toBe(2);
    expect(user.techTree.activeResearch).toBeUndefined();
    // Start second research (duration 20s)
    triggerResearch(user.techTree, ResearchType.IronHarvesting);
    user.updateStats(1022); // 12s pass, research not done
    expect(user.iron).toBeCloseTo(10 + 12 * 1.1, 5);
    expect(user.techTree.ironHarvesting).toBe(2);
    expect(user.techTree.activeResearch).toBeDefined();
    user.updateStats(1030); // 8s pass, research completes
    expect(user.iron).toBeCloseTo(10 + 20 * 1.1, 5);
    expect(user.techTree.ironHarvesting).toBe(3);
    expect(user.techTree.activeResearch).toBeUndefined();
    // Start third research (duration 40s)
    triggerResearch(user.techTree, ResearchType.IronHarvesting);
    user.updateStats(1050); // 20s pass, research not done
    expect(user.iron).toBeCloseTo(10 + 22 + 20 * 1.21, 5);
    expect(user.techTree.ironHarvesting).toBe(3);
    expect(user.techTree.activeResearch).toBeDefined();
    user.updateStats(1070); // 20s pass, research completes
    expect(user.iron).toBeCloseTo(10 + 22 + 40 * 1.21, 5);
    expect(user.techTree.ironHarvesting).toBe(4);
    expect(user.techTree.activeResearch).toBeUndefined();
    // Start fourth research (duration 80s)
    triggerResearch(user.techTree, ResearchType.IronHarvesting);
    user.updateStats(1110); // 40s pass, research not done
    expect(user.iron).toBeCloseTo(10 + 22 + 48.4 + 40 * 1.331, 5); // 10+22+48.4+40*1.331
    expect(user.techTree.ironHarvesting).toBe(4);
    expect(user.techTree.activeResearch).toBeDefined();
    user.updateStats(1150); // 40s pass, research completes
    expect(user.iron).toBeCloseTo(10 + 22 + 48.4 + 80 * 1.331, 5); // 10+22+48.4+80*1.331
    expect(user.techTree.ironHarvesting).toBe(5);
    expect(user.techTree.activeResearch).toBeUndefined();
  });

  test('updateStats_researchAlreadyCompleted_awardsAllIronAtNewRate', () => {
    // Manually upgrade
    user.techTree.ironHarvesting = 2;
    user.updateStats(1010);
    expect(user.iron).toBeCloseTo(10 * getResearchEffectFromTree(user.techTree, ResearchType.IronHarvesting));
  });

  test('updateStats_nonIronHarvestingResearch_awardsAllIronAtOldRate', () => {
    // Start ShipVelocity research (does not affect iron)
    triggerResearch(user.techTree, ResearchType.ShipVelocity);
    user.updateStats(1010);
    expect(user.iron).toBeCloseTo(10);
    expect(user.techTree.activeResearch).toBeDefined();
  });
});
