#!/usr/bin/env tsx

/**
 * Generates comprehensive balancing documentation charts for all researches and key comparisons.
 * Usage: npm run balancing-charts
 * Output: Charts are placed in doc/balancing/
 */

import { execSync } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import {
  IMPLEMENTED_RESEARCHES,
  ResearchType,
} from '../src/lib/server/techs/techtree.js';

const OUTPUT_DIR = path.join(process.cwd(), 'doc', 'balancing');
const LEVELS = { min: 1, max: 30 };

/**
 * Groupings of researches for comparison charts
 */
const RESEARCH_GROUPS = {
  // Weapons comparison
  energyVsProjectile: {
    label: 'Energy vs Projectile Damage',
    researches: [ResearchType.EnergyDamage, ResearchType.ProjectileDamage],
    dir: 'weapons-comparison',
  },
  energyVsProjectileReload: {
    label: 'Energy vs Projectile Reload',
    researches: [ResearchType.EnergyRechargeRate, ResearchType.ProjectileReloadRate],
    dir: 'weapons-comparison',
  },
  energyVsProjectileAccuracy: {
    label: 'Energy vs Projectile Accuracy',
    researches: [ResearchType.EnergyAccuracy, ResearchType.ProjectileAccuracy],
    dir: 'weapons-comparison',
  },
  // Defense comparison
  defenseTypes: {
    label: 'Defense Types Progression',
    researches: [ResearchType.HullStrength, ResearchType.ArmorEffectiveness, ResearchType.ShieldEffectiveness],
    dir: 'defense-comparison',
  },
  defenseRegen: {
    label: 'Defense Regeneration (Repair vs Shield)',
    researches: [ResearchType.RepairSpeed, ResearchType.ShieldRechargeRate],
    dir: 'defense-comparison',
  },
  // Weapons vs Defense
  weaponsVsDefense: {
    label: 'Weapons vs Defense - Damage Potential',
    researches: [ResearchType.ProjectileDamage, ResearchType.EnergyDamage, ResearchType.HullStrength, ResearchType.ArmorEffectiveness],
    dir: 'weapons-vs-defense',
  },
  // Economy
  ironEconomy: {
    label: 'Iron Economy - Production vs Capacity',
    researches: [ResearchType.IronHarvesting, ResearchType.IronCapacity],
    dir: 'economy',
  },
  // Ship mobility
  shipMobility: {
    label: 'Ship Mobility - Speed vs Afterburner',
    researches: [ResearchType.ShipSpeed, ResearchType.AfterburnerSpeedIncrease],
    dir: 'ship-mobility',
  },
  // Teleport progression
  teleport: {
    label: 'Teleport System',
    researches: [ResearchType.Teleport, ResearchType.TeleportRechargeSpeed],
    dir: 'teleport',
  },
};

interface ChartDefinition {
  type: 'individual' | 'comparison';
  researches: ResearchType[];
  filename?: string;
}

async function runChartGeneration(researches: ResearchType[], outDir: string): Promise<void> {
  const researchArgs = researches
    .map((r) => `"${r}"`)
    .join(' ');
  
  const cmd = `tsx scripts/generate-techtree-chart.ts --research ${researchArgs} --min ${LEVELS.min} --max ${LEVELS.max} --out-dir "${outDir}"`;
  
  try {
    execSync(cmd, { cwd: process.cwd(), stdio: 'inherit' });
  } catch (error) {
    console.error(`Failed to generate chart for researches: ${researches.join(', ')}`);
    throw error;
  }
}

async function generateIndividualCharts(): Promise<void> {
  console.log('\n📊 Generating individual research charts...');
  
  const individualsDir = path.join(OUTPUT_DIR, 'individual-research');
  await fs.mkdir(individualsDir, { recursive: true });

  const researches = Array.from(IMPLEMENTED_RESEARCHES).sort();
  
  for (const research of researches) {
    console.log(`  📈 ${research}...`);
    await runChartGeneration([research], individualsDir);
  }
  
  console.log(`  ✅ Generated ${researches.length} individual research charts`);
}

async function generateComparisonCharts(): Promise<void> {
  console.log('\n🔍 Generating comparison charts...');
  
  for (const [key, group] of Object.entries(RESEARCH_GROUPS)) {
    const groupDir = path.join(OUTPUT_DIR, group.dir);
    await fs.mkdir(groupDir, { recursive: true });
    
    console.log(`  📊 ${group.label}...`);
    await runChartGeneration(group.researches, groupDir);
  }
  
  console.log(`  ✅ Generated ${Object.keys(RESEARCH_GROUPS).length} comparison charts`);
}

async function generateChartIndex(): Promise<void> {
  console.log('\n📝 Generating chart index...');
  
  const indexPath = path.join(OUTPUT_DIR, 'CHART-INDEX.md');
  
  const researches = Array.from(IMPLEMENTED_RESEARCHES).sort();
  
  const individualChartsMarkdown = researches
    .map((r) => {
      const filename = r.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
      return `- [${r}](./individual-research/techtree-progression-${filename}-l1-to-l30.svg)`;
    })
    .join('\n');

  const comparisonChartsMarkdown = Object.entries(RESEARCH_GROUPS)
    .map(([, group]) => {
      const researchNames = group.researches.map((r) => r.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()).join('-vs-');
      const filename = `techtree-progression-${researchNames}-l1-to-l30.svg`;
      return `- [${group.label}](./${group.dir}/${filename})`;
    })
    .join('\n');

  const markdown = `# Balancing Charts Index

This directory contains auto-generated SVG charts that visualize research progression and balance relationships in Spacewars Ironstrike.

## Individual Research Charts

Charts showing the effect curve for each research from level 1 to level 30.

${individualChartsMarkdown}

## Comparison Charts

### Weapons Comparison
Comparing damage, reload rate, and accuracy between energy and projectile weapons.

${comparisonChartsMarkdown.split('\n').filter((l) => l.includes('weapons-comparison')).join('\n')}

### Defense Comparison
Comparing effectiveness and regeneration rates across defense types.

${comparisonChartsMarkdown.split('\n').filter((l) => l.includes('defense-comparison')).join('\n')}

### Weapons vs Defense
Comparing offensive and defensive progression to assess balance.

${comparisonChartsMarkdown.split('\n').filter((l) => l.includes('weapons-vs-defense')).join('\n')}

### Economy
Iron production and storage capacity progression.

${comparisonChartsMarkdown.split('\n').filter((l) => l.includes('economy')).join('\n')}

### Ship Mobility
Speed and afterburner progression.

${comparisonChartsMarkdown.split('\n').filter((l) => l.includes('ship-mobility')).join('\n')}

### Teleport System
Teleport charges and recharge speed progression.

${comparisonChartsMarkdown.split('\n').filter((l) => l.includes('teleport')).join('\n')}

## How to Use These Charts

1. **Individual Research**: Use to understand how each tech scales across levels and plan your research progression.
2. **Comparisons**: Use to analyze balance between competing research options and identify dominant strategies.
3. **Dual-axis charts**: When comparing different researches, secondary lines are scaled to intersect at level 1, allowing side-by-side comparison of growth patterns.

## Regenerating Charts

To regenerate these charts, run:

\`\`\`bash
npm run balancing-charts
\`\`\`

Or generate individual charts:

\`\`\`bash
npm run techtree-chart -- --research ShipSpeed --min 1 --max 30
\`\`\`
`;

  await fs.writeFile(indexPath, markdown, 'utf-8');
  console.log(`  ✅ Generated chart index at ${indexPath}`);
}

async function main(): Promise<void> {
  console.log('🎯 Spacewars Balancing Charts Generator');
  console.log('========================================\n');
  
  try {
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    
    await generateIndividualCharts();
    await generateComparisonCharts();
    await generateChartIndex();
    
    console.log('\n✅ All balancing charts generated successfully!');
    console.log(`📁 Charts location: ${OUTPUT_DIR}`);
    console.log(`📖 Chart index: ${path.join(OUTPUT_DIR, 'CHART-INDEX.md')}`);
  } catch (error) {
    console.error('\n❌ Chart generation failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
