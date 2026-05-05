#!/usr/bin/env tsx

import fs from 'fs/promises';
import path from 'path';
import {
  AllResearches,
  getResearchEffect,
  Research,
  ResearchType,
} from '../src/lib/server/techs/techtree.js';

type ParsedArgs = {
  researches: ResearchType[];
  minLevel: number;
  maxLevel: number;
  outDir: string;
  variantsFile?: string;
};

type Series = {
  researchType: ResearchType;
  label: string;
  unit: string;
  points: Array<{ level: number; effect: number }>;
  source?: {
    id: string;
    research: Research;
    isBaseline: boolean;
  };
};

type VariantDefinition = {
  id: string;
  label?: string;
  baseValueIncrease?: {
    type: Research['baseValueIncrease']['type'];
    value: number;
  };
  baseValue?: number;
  baseUpgradeCost?: number;
  baseUpgradeDuration?: number;
  upgradeCostIncrease?: number;
  level?: number;
  unit?: string;
};

type VariantsConfig = {
  research: string;
  includeBaseline?: boolean;
  variants: VariantDefinition[];
};

const DEFAULT_MIN_LEVEL = 1;
const DEFAULT_MAX_LEVEL = 20;
const DEFAULT_OUTPUT_DIR = path.join(process.cwd(), 'doc', 'balacing');
const COLORS = ['#1b1b1b', '#0072B2', '#D55E00', '#009E73', '#CC79A7', '#E69F00', '#56B4E9'];

function printHelp(): void {
  console.log(`
Usage:
  tsx scripts/generate-techtree-chart.ts --research <name> [--research <name>] [--min <n>] [--max <n>] [--out-dir <path>]
  tsx scripts/generate-techtree-chart.ts --variants-file <path> [--min <n>] [--max <n>] [--out-dir <path>]

Examples:
  tsx scripts/generate-techtree-chart.ts --research shipSpeed
  tsx scripts/generate-techtree-chart.ts --research shipSpeed --research ironCapacity --min 1 --max 40
  tsx scripts/generate-techtree-chart.ts -r ShipSpeed -r TeleportRechargeSpeed
  tsx scripts/generate-techtree-chart.ts --variants-file doc/balacing/experiments/repair-speed-growth.json --min 1 --max 30

Notes:
  - One research creates a single-axis chart.
  - Multiple researches create a dual-axis chart.
  - In multi mode, all non-primary lines are scaled to intersect at the primary line's level 1 effect.
  - Variant mode compares multiple formulas for one research in a single-axis chart.
  - Research names accept enum key or value (case-insensitive).
  `);
}

function parseLevel(value: string | undefined, flagName: string, fallback: number): number {
  if (value === undefined) return fallback;
  const num = Number.parseInt(value, 10);
  if (!Number.isFinite(num) || Number.isNaN(num) || num < 0) {
    throw new Error(`Invalid ${flagName}: '${value}'. Expected a non-negative integer.`);
  }
  return num;
}

function resolveResearchType(token: string): ResearchType {
  const raw = token.trim();
  if (!raw) {
    throw new Error('Research token cannot be empty.');
  }

  const values = Object.values(ResearchType) as string[];
  const exactValue = values.find((v) => v.toLowerCase() === raw.toLowerCase());
  if (exactValue) return exactValue as ResearchType;

  const keys = Object.keys(ResearchType) as Array<keyof typeof ResearchType>;
  const exactKey = keys.find((k) => k.toLowerCase() === raw.toLowerCase());
  if (exactKey) return ResearchType[exactKey];

  const available = [...keys, ...values].join(', ');
  throw new Error(`Unknown research '${token}'. Available values/keys: ${available}`);
}

function parseArgs(argv: string[]): ParsedArgs {
  const researchTokens: string[] = [];
  let minLevel = DEFAULT_MIN_LEVEL;
  let maxLevel = DEFAULT_MAX_LEVEL;
  let outDir = DEFAULT_OUTPUT_DIR;
  let variantsFile: string | undefined;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }

    if (arg === '--research' || arg === '-r') {
      const value = argv[i + 1];
      if (!value || value.startsWith('-')) {
        throw new Error(`Missing value for ${arg}.`);
      }
      value.split(',').map((v) => v.trim()).filter(Boolean).forEach((v) => researchTokens.push(v));
      i += 1;
      continue;
    }

    if (arg === '--min') {
      minLevel = parseLevel(argv[i + 1], '--min', DEFAULT_MIN_LEVEL);
      i += 1;
      continue;
    }

    if (arg === '--max') {
      maxLevel = parseLevel(argv[i + 1], '--max', DEFAULT_MAX_LEVEL);
      i += 1;
      continue;
    }

    if (arg === '--out-dir') {
      const value = argv[i + 1];
      if (!value || value.startsWith('-')) {
        throw new Error('Missing value for --out-dir.');
      }
      outDir = path.isAbsolute(value) ? value : path.join(process.cwd(), value);
      i += 1;
      continue;
    }

    if (arg === '--variants-file') {
      const value = argv[i + 1];
      if (!value || value.startsWith('-')) {
        throw new Error('Missing value for --variants-file.');
      }
      variantsFile = path.isAbsolute(value) ? value : path.join(process.cwd(), value);
      i += 1;
      continue;
    }

    if (arg.startsWith('-')) {
      throw new Error(`Unknown flag: ${arg}`);
    }

    arg.split(',').map((v) => v.trim()).filter(Boolean).forEach((v) => researchTokens.push(v));
  }

  if (researchTokens.length === 0 && !variantsFile) {
    throw new Error('At least one research is required. Use --research <name>.');
  }

  if (researchTokens.length > 0 && variantsFile) {
    throw new Error('Use either --research or --variants-file, not both at the same time.');
  }

  const researchSet = new Set(researchTokens.map((t) => resolveResearchType(t)));
  const researches = [...researchSet];

  if (minLevel > maxLevel) {
    throw new Error(`Invalid level range: min (${minLevel}) cannot be greater than max (${maxLevel}).`);
  }

  return { researches, minLevel, maxLevel, outDir, variantsFile };
}

function buildSeries(type: ResearchType, minLevel: number, maxLevel: number): Series {
  const research = AllResearches[type];
  const points: Array<{ level: number; effect: number }> = [];

  for (let level = minLevel; level <= maxLevel; level += 1) {
    points.push({
      level,
      effect: getResearchEffect(research, level),
    });
  }

  return {
    researchType: type,
    label: research.name,
    unit: research.unit,
    points,
    source: {
      id: type,
      research,
      isBaseline: true,
    },
  };
}

function buildSeriesFromResearch(type: ResearchType, research: Research, label: string, minLevel: number, maxLevel: number, id: string, isBaseline: boolean): Series {
  const points: Array<{ level: number; effect: number }> = [];

  for (let level = minLevel; level <= maxLevel; level += 1) {
    points.push({
      level,
      effect: getResearchEffect(research, level),
    });
  }

  return {
    researchType: type,
    label,
    unit: research.unit,
    points,
    source: {
      id,
      research,
      isBaseline,
    },
  };
}

function isVariantsConfig(input: unknown): input is VariantsConfig {
  if (!input || typeof input !== 'object') return false;
  const obj = input as Record<string, unknown>;
  return typeof obj.research === 'string' && Array.isArray(obj.variants);
}

async function loadVariantSeries(configPath: string, minLevel: number, maxLevel: number): Promise<Series[]> {
  const content = await fs.readFile(configPath, 'utf-8');
  const parsed = JSON.parse(content) as unknown;

  if (!isVariantsConfig(parsed)) {
    throw new Error(`Invalid variants file format in ${configPath}. Expected { research: string, variants: [] }.`);
  }

  const researchType = resolveResearchType(parsed.research);
  const baseResearch = AllResearches[researchType];
  const includeBaseline = parsed.includeBaseline ?? true;
  const series: Series[] = [];

  if (includeBaseline) {
    series.push(
      buildSeriesFromResearch(
        researchType,
        { ...baseResearch },
        `${baseResearch.name} (baseline)` ,
        minLevel,
        maxLevel,
        'baseline',
        true
      )
    );
  }

  parsed.variants.forEach((variant) => {
    if (!variant.id || typeof variant.id !== 'string') {
      throw new Error('Each variant must have a non-empty string id.');
    }

    const modified: Research = {
      ...baseResearch,
      baseValueIncrease: variant.baseValueIncrease
        ? { ...variant.baseValueIncrease }
        : { ...baseResearch.baseValueIncrease },
      baseValue: variant.baseValue ?? baseResearch.baseValue,
      baseUpgradeCost: variant.baseUpgradeCost ?? baseResearch.baseUpgradeCost,
      baseUpgradeDuration: variant.baseUpgradeDuration ?? baseResearch.baseUpgradeDuration,
      upgradeCostIncrease: variant.upgradeCostIncrease ?? baseResearch.upgradeCostIncrease,
      level: variant.level ?? baseResearch.level,
      unit: variant.unit ?? baseResearch.unit,
      name: variant.label ?? `${baseResearch.name} (${variant.id})`,
    };

    const growth = modified.baseValueIncrease;
    const suffix = `${growth.type}:${growth.value}`;
    const label = variant.label ?? `${variant.id} (${suffix})`;

    series.push(
      buildSeriesFromResearch(
        researchType,
        modified,
        label,
        minLevel,
        maxLevel,
        variant.id,
        false
      )
    );
  });

  if (series.length === 0) {
    throw new Error(`Variants file ${configPath} produced no series.`);
  }

  return series;
}

function minMax(values: number[]): { min: number; max: number } {
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return { min: 0, max: 1 };
  }
  if (min === max) {
    const pad = Math.abs(min) * 0.1 || 1;
    return { min: 0, max: max + pad };
  }
  const upperPad = max * 0.08;
  return { min: 0, max: max + upperPad };
}

function scaleLinear(value: number, domainMin: number, domainMax: number, rangeMin: number, rangeMax: number): number {
  if (domainMax === domainMin) return (rangeMin + rangeMax) / 2;
  const ratio = (value - domainMin) / (domainMax - domainMin);
  return rangeMin + ratio * (rangeMax - rangeMin);
}

function formatNumber(value: number): string {
  if (Math.abs(value) >= 1000 || Math.abs(value) < 0.01) {
    return value.toExponential(2);
  }
  return Number(value.toFixed(3)).toString();
}

function buildTicks(min: number, max: number, count: number): number[] {
  if (count < 2) return [min, max];
  const ticks: number[] = [];
  for (let i = 0; i < count; i += 1) {
    ticks.push(min + ((max - min) * i) / (count - 1));
  }
  return ticks;
}

function linePath(points: Array<{ x: number; y: number }>): string {
  return points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ');
}

function esc(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function createSvg(args: ParsedArgs, series: Series[]): string {
  const width = 1200;
  const height = 760;
  const margin = {
    top: 80,
    right: series.length >= 2 ? 160 : 80,
    bottom: 80,
    left: 120,
  };

  const plotLeft = margin.left;
  const plotRight = width - margin.right;
  const plotTop = margin.top;
  const plotBottom = height - margin.bottom;
  const plotWidth = plotRight - plotLeft;
  const plotHeight = plotBottom - plotTop;

  const levels = series[0].points.map((p) => p.level);
  const xMin = levels[0];
  const xMax = levels[levels.length - 1];

  const leftValues = series[0].points.map((p) => p.effect);
  const leftRange = minMax(leftValues);

  const xOf = (level: number): number => scaleLinear(level, xMin, xMax, plotLeft, plotRight);
  const yOfLeft = (value: number): number => scaleLinear(value, leftRange.min, leftRange.max, plotBottom, plotTop);

  const allSameResearch = series.every((entry) => entry.researchType === series[0].researchType);
  const useDualAxisScaling = series.length >= 2 && !allSameResearch;

  const primaryLevelOneEffect = series[0].points.find((p) => p.level === 1)?.effect ?? series[0].points[0]?.effect ?? 1;
  const scaleFactorBySeriesIndex = series.map((entry, index) => {
    if (index === 0 || !useDualAxisScaling) return 1;
    const levelOneEffect = entry.points.find((p) => p.level === 1)?.effect ?? entry.points[0]?.effect ?? 1;
    return levelOneEffect === 0 ? 1 : primaryLevelOneEffect / levelOneEffect;
  });

  const xTicks = Array.from(new Set(buildTicks(xMin, xMax, Math.min(10, xMax - xMin + 1)).map((t) => Math.round(t))));
  const leftTicks = buildTicks(leftRange.min, leftRange.max, 6);
  const rightTicks = useDualAxisScaling
    ? leftTicks.map((tick) => tick / (primaryLevelOneEffect === 0 ? 1 : primaryLevelOneEffect))
    : [];

  const firstPoints = series[0].points.map((p) => ({ x: xOf(p.level), y: yOfLeft(p.effect) }));
  const firstPath = linePath(firstPoints);

  const additionalPaths = series.slice(1).map((entry, idx) => {
    const scaleFactor = scaleFactorBySeriesIndex[idx + 1];
    const points = entry.points.map((p) => ({ x: xOf(p.level), y: yOfLeft(p.effect * scaleFactor) }));
    const useDashedStyle = !!entry.source && !entry.source.isBaseline && !useDualAxisScaling;
    return {
      path: linePath(points),
      color: COLORS[(idx + 1) % COLORS.length],
      dashArray: useDashedStyle ? '8 4' : undefined,
    };
  });

  const gridLinesY = leftTicks
    .map((tick) => {
      const y = yOfLeft(tick);
      return `<line x1="${plotLeft}" y1="${y.toFixed(2)}" x2="${plotRight}" y2="${y.toFixed(2)}" stroke="#d3d8db" stroke-width="1" />`;
    })
    .join('\n');

  const gridLinesX = xTicks
    .map((tick) => {
      const x = xOf(tick);
      return `<line x1="${x.toFixed(2)}" y1="${plotTop}" x2="${x.toFixed(2)}" y2="${plotBottom}" stroke="#eceff1" stroke-width="1" />`;
    })
    .join('\n');

  const xLabels = xTicks
    .map((tick) => {
      const x = xOf(tick);
      return `<text x="${x.toFixed(2)}" y="${plotBottom + 28}" font-size="14" text-anchor="middle" fill="#24333b">${tick}</text>`;
    })
    .join('\n');

  const leftLabels = leftTicks
    .map((tick) => {
      const y = yOfLeft(tick);
      return `<text x="${plotLeft - 14}" y="${(y + 5).toFixed(2)}" font-size="13" text-anchor="end" fill="#204f4f">${formatNumber(tick)}</text>`;
    })
    .join('\n');

  const rightLabels = useDualAxisScaling
    ? rightTicks
      .map((tick) => {
        const y = yOfLeft(tick * (primaryLevelOneEffect === 0 ? 1 : primaryLevelOneEffect));
        return `<text x="${plotRight + 14}" y="${(y + 5).toFixed(2)}" font-size="13" text-anchor="start" fill="#7b3527">${formatNumber(tick)}x</text>`;
      })
      .join('\n')
    : '';

  const title = series.length === 1
    ? `${series[0].label} progression (L${args.minLevel}..L${args.maxLevel})`
    : `${series.map((s) => s.label).join(' vs ')} progression (L${args.minLevel}..L${args.maxLevel})`;

  const subtitle = series.length === 1
    ? `Effect unit: ${series[0].unit}`
    : useDualAxisScaling
      ? `Dual axis: all secondary lines are scaled to intersect at level 1 (right axis = multiplier vs L1)`
      : `Variant comparison for ${series[0].label.split(' (')[0]} (single axis)`;

  const additionalLines = additionalPaths
    .map((entry) => `<path d="${entry.path}" fill="none" stroke="${entry.color}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"${entry.dashArray ? ` stroke-dasharray="${entry.dashArray}"` : ''} />`)
    .join('\n');

  const rightAxisTitle = useDualAxisScaling
    ? `<text x="${plotRight + 95}" y="${plotTop - 20}" font-size="13" text-anchor="middle" fill="#7b3527">Relative Effect (x of level 1)</text>`
    : '';

  const rightAxis = useDualAxisScaling
    ? `<line x1="${plotRight}" y1="${plotTop}" x2="${plotRight}" y2="${plotBottom}" stroke="#7b3527" stroke-width="2" />`
    : '';

  const legendEntries = series
    .map((entry, idx) => {
      const color = COLORS[idx % COLORS.length];
      const useDashedStyle = !!entry.source && !entry.source.isBaseline && !useDualAxisScaling;
      const dashArray = useDashedStyle ? '8 4' : undefined;
      const shortLabel = useDualAxisScaling
        ? `${entry.label} (${entry.unit})`
        : entry.label;
      return {
        label: shortLabel,
        color,
        dashArray,
      };
    })
;

  const legendX = plotLeft + 16;
  const legendY = plotTop + 16;
  const legendRowHeight = 22;
  const legendPadding = 10;
  const legendWidth = Math.min(560, Math.max(280, plotWidth - 40));
  const legendHeight = legendEntries.length * legendRowHeight + legendPadding * 2;

  const legendItems = legendEntries
    .map((entry, idx) => {
      const rowY = legendY + legendPadding + idx * legendRowHeight;
      return `<g>
      <line x1="${legendX + 10}" y1="${rowY + 7}" x2="${legendX + 34}" y2="${rowY + 7}" stroke="${entry.color}" stroke-width="4"${entry.dashArray ? ` stroke-dasharray="${entry.dashArray}"` : ''} />
      <text x="${legendX + 42}" y="${rowY + 11}" font-size="13" fill="#1f2d34">${esc(entry.label)}</text>
    </g>`;
    })
    .join('\n');

  const legendBlock = `<g>
    <rect x="${legendX}" y="${legendY}" width="${legendWidth}" height="${legendHeight}" fill="#ffffff" fill-opacity="0.92" stroke="#b8c4cb" />
    ${legendItems}
  </g>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect x="0" y="0" width="${width}" height="${height}" fill="#f7fafb" />
  <rect x="${plotLeft}" y="${plotTop}" width="${plotWidth}" height="${plotHeight}" fill="#ffffff" stroke="#cad3d8" />

  ${gridLinesY}
  ${gridLinesX}

  <line x1="${plotLeft}" y1="${plotBottom}" x2="${plotRight}" y2="${plotBottom}" stroke="#24333b" stroke-width="2" />
  <line x1="${plotLeft}" y1="${plotTop}" x2="${plotLeft}" y2="${plotBottom}" stroke="#0d6e6e" stroke-width="2" />
  ${rightAxis}

  <path d="${firstPath}" fill="none" stroke="${COLORS[0]}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" />
  ${additionalLines}
  ${legendBlock}

  ${xLabels}
  ${leftLabels}
  ${rightLabels}

  <text x="${width / 2}" y="34" font-size="24" text-anchor="middle" fill="#122028">${esc(title)}</text>
  <text x="${width / 2}" y="58" font-size="14" text-anchor="middle" fill="#45606d">${esc(subtitle)}</text>

  <text x="${width / 2}" y="${height - 24}" font-size="14" text-anchor="middle" fill="#24333b">Level</text>
  <text x="${plotLeft - 75}" y="${plotTop - 20}" font-size="13" text-anchor="middle" fill="#204f4f">${esc(series[0].label)} (${esc(series[0].unit)})</text>
  ${rightAxisTitle}

</svg>`;
}

function fileNameFromArgs(args: ParsedArgs): string {
  if (args.variantsFile) {
    const variantBase = path.basename(args.variantsFile, path.extname(args.variantsFile)).replace(/\s+/g, '-').toLowerCase();
    return `techtree-variants-${variantBase}-l${args.minLevel}-to-l${args.maxLevel}.svg`;
  }

  const baseResearchPart = args.researches
    .map((r) => r.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase())
    .join('-vs-');
  return `techtree-progression-${baseResearchPart}-l${args.minLevel}-to-l${args.maxLevel}.svg`;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const series = args.variantsFile
    ? await loadVariantSeries(args.variantsFile, args.minLevel, args.maxLevel)
    : args.researches.map((r) => buildSeries(r, args.minLevel, args.maxLevel));
  const svg = createSvg(args, series);

  await fs.mkdir(args.outDir, { recursive: true });
  const outputPath = path.join(args.outDir, fileNameFromArgs(args));
  await fs.writeFile(outputPath, svg, 'utf-8');

  console.log(`Generated chart: ${outputPath}`);
}

main().catch((error) => {
  console.error('Failed to generate techtree chart:', error instanceof Error ? error.message : error);
  process.exit(1);
});
