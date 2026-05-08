#!/usr/bin/env tsx

/**
 * Calculates the number of battles needed to reach each level (1-10)
 * considering different opponent level scenarios within legal range (±3 levels)
 */

// XP thresholds for each level (cumulative)
function calculateXpThreshold(level: number): number {
  let total = 0;
  for (let k = 1; k < level; k++) {
    total += (k * (k + 1) / 2) * 1000;
  }
  return total;
}

// XP needed to advance to next level
function calculateXpForAdvance(level: number): number {
  const next = calculateXpThreshold(level + 1);
  const current = calculateXpThreshold(level);
  return next - current;
}

// XP reward for beating an opponent
function calculateBattleXp(winnerLevel: number, loserLevel: number): number {
  const baseXp = loserLevel * 200;
  const levelDiff = loserLevel - winnerLevel;

  let xp: number;
  if (levelDiff > 0) {
    xp = baseXp * Math.pow(1.3, levelDiff);
  } else if (levelDiff < 0) {
    xp = baseXp * Math.pow(0.7, Math.abs(levelDiff));
  } else {
    xp = baseXp;
  }

  return Math.floor(xp);
}

// Check if battle is legal (level difference ≤ 3)
function isLegalBattle(level1: number, level2: number): boolean {
  return Math.abs(level1 - level2) <= 3;
}

// Calculate battles needed for a level transition
function calculateBattlesNeeded(currentLevel: number, opponentLevel: number): number {
  const xpNeeded = calculateXpForAdvance(currentLevel);
  const xpPerBattle = calculateBattleXp(currentLevel, opponentLevel);
  return Math.ceil(xpNeeded / xpPerBattle);
}

console.log('Level Progression Battle Requirements\n');
console.log('='.repeat(160));

for (let level = 1; level <= 10; level++) {
  const xpNeeded = calculateXpForAdvance(level);
  console.log(`\n📊 Level ${level} → Level ${level + 1} (${xpNeeded.toLocaleString()} XP needed)`);
  console.log('-'.repeat(160));

  const scenarios: Array<{ opponentLevel: number; description: string; diff: number; xpPerBattle: number; battlesNeeded: number; totalXp: number }> = [];

  // Generate all opponent levels from current-3 to current+3
  for (let diff = -3; diff <= 3; diff++) {
    const opponentLevel = level + diff;
    
    if (opponentLevel < 1) continue; // Can't battle level 0 or below
    if (!isLegalBattle(level, opponentLevel)) continue; // Must be within ±3 levels
    
    const xp = calculateBattleXp(level, opponentLevel);
    const battles = calculateBattlesNeeded(level, opponentLevel);
    
    const sign = diff > 0 ? '+' : '';
    const description = diff === 0 
      ? `Same Level (${opponentLevel})`
      : `Level ${sign}${diff} (${opponentLevel})`;
    
    scenarios.push({
      opponentLevel,
      description,
      diff,
      xpPerBattle: xp,
      battlesNeeded: battles,
      totalXp: xp * battles,
    });
  }

  // Sort by diff for consistent ordering
  scenarios.sort((a, b) => a.diff - b.diff);

  // Print scenarios
  for (const scenario of scenarios) {
    const bonus = scenario.totalXp > xpNeeded ? ` (+${scenario.totalXp - xpNeeded} overflow)` : '';
    console.log(
      `  ${scenario.description.padEnd(35)} | ${scenario.xpPerBattle.toString().padStart(6)} XP/battle | ${scenario.battlesNeeded.toString().padStart(3)} battles${bonus}`
    );
  }
}

console.log('\n' + '='.repeat(160));
console.log('\nSummary Table:\n');

// Create table header
const header = ['Level', 'XP Needed', 'Lv-3', 'Lv-2', 'Lv-1', 'Same Lv', 'Lv+1', 'Lv+2', 'Lv+3'];
const columnWidths = [10, 15, 12, 12, 12, 12, 12, 12, 12];

console.log(
  header.map((h, i) => h.padEnd(columnWidths[i])).join(' | ')
);
console.log('-'.repeat(160));

// Create table rows
for (let level = 1; level <= 10; level++) {
  const xpNeeded = calculateXpForAdvance(level);
  let row = [
    `${level} → ${level + 1}`.padEnd(columnWidths[0]),
    xpNeeded.toLocaleString().padEnd(columnWidths[1]),
  ];

  // Generate all opponent levels from current-3 to current+3
  for (let diff = -3; diff <= 3; diff++) {
    const opponentLevel = level + diff;
    
    let battleStr: string;
    if (opponentLevel < 1) {
      battleStr = 'N/A';
    } else if (!isLegalBattle(level, opponentLevel)) {
      battleStr = 'N/A';
    } else {
      const battles = calculateBattlesNeeded(level, opponentLevel);
      battleStr = `${battles}`;
    }
    
    row.push(battleStr.padEnd(columnWidths[diff + 5]));
  }

  console.log(row.join(' | '));
}

console.log('\n' + '='.repeat(120));
console.log('\nNotes:');
console.log('  • Level difference constraint: ±3 levels (battle is only allowed within this range)');
console.log('  • XP formula: baseXp = opponent_level × 200');
console.log('  •   - Same level: full baseXp');
console.log('  •   - Beating higher level: baseXp × 1.3^(level_diff)');
console.log('  •   - Beating lower level: baseXp × 0.7^(level_diff)');
console.log('  • "N/A" indicates legally impossible matchup');
