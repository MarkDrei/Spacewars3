import { describe, it } from 'vitest';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import {
  AllResearches,
  ResearchType,
  getResearchUpgradeCost,
  getResearchUpgradeDuration,
  getResearchEffect,
} from '@/lib/server/techtree';

describe('Tech Tree Report Generation', () => {
  it('generateTechTreeReport_first50Levels_createHTMLReport', () => {
    const outputDir = join(process.cwd(), 'test-output');
    mkdirSync(outputDir, { recursive: true });

    // Collect data for all techs across 50 levels
    interface LevelData {
      level: number;
      upgradeCost: number;
      upgradeDuration: number;
      effect: number;
      cumulativeCost: number;
      cumulativeDuration: number;
    }

    interface TechData {
      research: typeof AllResearches[ResearchType];
      levels: LevelData[];
    }

    const techData: TechData[] = [];

    // Process each research type
    Object.values(ResearchType).forEach((type) => {
      const research = AllResearches[type];
      const levels: LevelData[] = [];
      const startLevel = research.level;

      let cumulativeCost = 0;
      let cumulativeDuration = 0;

      // Generate data for levels 1-50
      for (let level = 1; level <= 50; level++) {
        // Calculate upgrade cost (cost to upgrade TO this level)
        const upgradeCost = getResearchUpgradeCost(research, level);
        const upgradeDuration = getResearchUpgradeDuration(research, level);
        const effect = getResearchEffect(research, level);

        // Add to cumulative totals if this level is above start level
        if (level > startLevel) {
          cumulativeCost += upgradeCost;
          cumulativeDuration += upgradeDuration;
        }

        levels.push({
          level,
          upgradeCost,
          upgradeDuration,
          effect,
          cumulativeCost,
          cumulativeDuration,
        });
      }

      techData.push({ research, levels });
    });

    // Generate HTML report
    const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Tech Tree Report - Levels 1-50</title>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      margin: 40px;
      background: linear-gradient(135deg, #0a0e27 0%, #1a1f3a 100%);
      color: #e0e0e0;
    }
    .container {
      max-width: 1400px;
      margin: 0 auto;
    }
    h1 {
      color: #00d9ff;
      text-align: center;
      font-size: 2.5em;
      margin-bottom: 10px;
      text-shadow: 0 0 20px rgba(0, 217, 255, 0.5);
    }
    .subtitle {
      text-align: center;
      color: #888;
      margin-bottom: 40px;
    }
    .tech-section {
      margin-bottom: 60px;
      background: rgba(26, 31, 58, 0.6);
      border-radius: 12px;
      padding: 30px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    }
    .tech-header {
      margin-bottom: 20px;
      border-bottom: 2px solid #00d9ff;
      padding-bottom: 15px;
    }
    .tech-name {
      color: #00d9ff;
      font-size: 2em;
      margin: 0;
    }
    .tech-description {
      color: #aaa;
      margin-top: 8px;
      font-size: 1.1em;
    }
    .tech-stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 15px;
      margin: 20px 0;
      padding: 15px;
      background: rgba(0, 0, 0, 0.2);
      border-radius: 8px;
    }
    .stat-box {
      padding: 10px;
    }
    .stat-label {
      color: #888;
      font-size: 0.85em;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .stat-value {
      color: #00d9ff;
      font-size: 1.3em;
      font-weight: bold;
      margin-top: 5px;
    }
    table {
      border-collapse: collapse;
      width: 100%;
      margin: 20px 0;
      background: rgba(0, 0, 0, 0.3);
      border-radius: 8px;
      overflow: hidden;
    }
    th {
      background: linear-gradient(135deg, #1e3a5f 0%, #2a5a8f 100%);
      color: #00d9ff;
      padding: 15px 12px;
      text-align: right;
      font-weight: 600;
      font-size: 0.95em;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    th:first-child {
      text-align: center;
    }
    td {
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      padding: 12px;
      text-align: right;
      font-size: 0.95em;
    }
    td:first-child {
      text-align: center;
      font-weight: bold;
      color: #00d9ff;
    }
    tr:hover {
      background: rgba(0, 217, 255, 0.1);
    }
    tr.milestone {
      background: rgba(0, 217, 255, 0.15);
      font-weight: bold;
    }
    tr.milestone td {
      border-top: 2px solid #00d9ff;
      border-bottom: 2px solid #00d9ff;
    }
    .number {
      font-family: 'Courier New', monospace;
    }
    .summary-box {
      background: rgba(0, 217, 255, 0.1);
      border-left: 4px solid #00d9ff;
      padding: 20px;
      margin: 20px 0;
      border-radius: 8px;
    }
    .summary-title {
      color: #00d9ff;
      font-size: 1.2em;
      font-weight: bold;
      margin-bottom: 10px;
    }
    .summary-text {
      color: #ccc;
      line-height: 1.6;
    }
    .duration-format {
      color: #51cf66;
    }
    .cost-format {
      color: #ffa94d;
    }
    .effect-format {
      color: #d0bfff;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🚀 Tech Tree Progression Report</h1>
    <p class="subtitle">Complete analysis of all technologies from Level 1 to Level 50<br>
    Generated: ${new Date().toISOString()}</p>

    ${techData
      .map((tech) => {
        const startLevel = tech.research.level;
        const level50Data = tech.levels[49]; // Index 49 = level 50

        return `
    <div class="tech-section">
      <div class="tech-header">
        <h2 class="tech-name">${tech.research.name}</h2>
        <p class="tech-description">${tech.research.description}</p>
      </div>

      <div class="tech-stats">
        <div class="stat-box">
          <div class="stat-label">Starting Level</div>
          <div class="stat-value">${startLevel}</div>
        </div>
        <div class="stat-box">
          <div class="stat-label">Base Cost</div>
          <div class="stat-value class="cost-format">${tech.research.baseUpgradeCost.toLocaleString()} iron</div>
        </div>
        <div class="stat-box">
          <div class="stat-label">Base Duration</div>
          <div class="stat-value class="duration-format">${formatDuration(tech.research.baseUpgradeDuration)}</div>
        </div>
        <div class="stat-box">
          <div class="stat-label">Cost Multiplier</div>
          <div class="stat-value">${tech.research.upgradeCostIncrease}x</div>
        </div>
        <div class="stat-box">
          <div class="stat-label">Effect Increase</div>
          <div class="stat-value">${tech.research.baseValueIncrease.type === 'factor' ? `×${tech.research.baseValueIncrease.value}` : `+${tech.research.baseValueIncrease.value}`}</div>
        </div>
      </div>

      <div class="summary-box">
        <div class="summary-title">📊 Level 50 Summary</div>
        <div class="summary-text">
          <strong>Total Investment Required:</strong><br>
          • <span class="cost-format">${level50Data.cumulativeCost.toLocaleString()} iron</span> (from level ${startLevel} to level 50)<br>
          • <span class="duration-format">${formatDuration(level50Data.cumulativeDuration)}</span> total research time<br>
          • <strong>Effect at Level 50:</strong> <span class="effect-format">${level50Data.effect.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${tech.research.unit}</span>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Level</th>
            <th>Upgrade Cost<br><small>(to reach this level)</small></th>
            <th>Upgrade Duration<br><small>(to reach this level)</small></th>
            <th>Effect Value<br><small>(${tech.research.unit})</small></th>
            <th>Cumulative Cost<br><small>(from level ${startLevel})</small></th>
            <th>Cumulative Duration<br><small>(from level ${startLevel})</small></th>
          </tr>
        </thead>
        <tbody>
          ${tech.levels
            .map((levelData) => {
              const isMilestone = levelData.level % 10 === 0;
              return `
          <tr${isMilestone ? ' class="milestone"' : ''}>
            <td>${levelData.level}</td>
            <td class="number cost-format">${levelData.upgradeCost.toLocaleString()}</td>
            <td class="number duration-format">${formatDuration(levelData.upgradeDuration)}</td>
            <td class="number effect-format">${levelData.effect.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
            <td class="number cost-format">${levelData.cumulativeCost.toLocaleString()}</td>
            <td class="number duration-format">${formatDuration(levelData.cumulativeDuration)}</td>
          </tr>`;
            })
            .join('')}
        </tbody>
      </table>
    </div>`;
      })
      .join('')}

    <div class="summary-box" style="margin-top: 40px;">
      <div class="summary-title">📈 Report Notes</div>
      <div class="summary-text">
        <ul style="margin: 10px 0; padding-left: 20px;">
          <li><strong>Upgrade Cost:</strong> The iron cost required to upgrade TO that specific level</li>
          <li><strong>Upgrade Duration:</strong> The time required to complete the upgrade TO that level</li>
          <li><strong>Effect Value:</strong> The benefit provided at that level (e.g., iron/sec, speed, %)</li>
          <li><strong>Cumulative Cost:</strong> Total iron invested from the starting level to reach this level</li>
          <li><strong>Cumulative Duration:</strong> Total research time from the starting level to reach this level</li>
          <li><strong>Milestone Rows:</strong> Levels ending in 0 (10, 20, 30, 40, 50) are highlighted for easy reference</li>
        </ul>
      </div>
    </div>

  </div>

  <script>
    // Helper function to format duration (duplicated in JS for client-side use)
    function formatDuration(seconds) {
      if (seconds < 60) return seconds + 's';
      const minutes = Math.floor(seconds / 60);
      if (minutes < 60) return minutes + 'm';
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      if (hours < 24) return hours + 'h ' + remainingMinutes + 'm';
      const days = Math.floor(hours / 24);
      const remainingHours = hours % 24;
      return days + 'd ' + remainingHours + 'h';
    }
  </script>
</body>
</html>
    `;

    // Helper function to format duration
    function formatDuration(seconds: number): string {
      if (seconds < 60) return `${seconds}s`;
      const minutes = Math.floor(seconds / 60);
      if (minutes < 60) return `${minutes}m`;
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      if (hours < 24) return `${hours}h ${remainingMinutes}m`;
      const days = Math.floor(hours / 24);
      const remainingHours = hours % 24;
      return `${days}d ${remainingHours}h`;
    }

    const outputPath = join(outputDir, 'tech-tree-report.html');
    writeFileSync(outputPath, html);

    console.log(`✅ Generated Tech Tree Report: test-output/tech-tree-report.html`);
    console.log(`   Open with: open test-output/tech-tree-report.html`);
    console.log(`   Or in browser: file://${outputPath}`);
  });
});
