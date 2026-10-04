# Scripts

This folder contains utility scripts for local development and balancing workflows.

## Techtree Chart Generator

Script file:
[scripts/generate-techtree-chart.ts](scripts/generate-techtree-chart.ts)

NPM command:

- npm run techtree-chart -- [options]

Direct command:

- tsx scripts/generate-techtree-chart.ts [options]

### What it does

- Generates SVG charts for research effect progression across levels.
- Stores output in doc/balacing by default.
- X axis is level.
- Y axis is effect and always starts at 0.
- Supports two modes:
  - Research mode: compare one or multiple research types.
  - Variant mode: compare multiple growth formulas for the same research.

### CLI options

- --research <name>
  - Add one research type.
  - Can be used multiple times.
  - Supports enum key or value, case-insensitive.
  - Short form: -r
  - Example values: ShipSpeed, shipSpeed, repairSpeed, teleportRechargeSpeed

- --variants-file <path>
  - Path to a JSON file defining variants for one research.
  - Cannot be used together with --research.

- --min <n>
  - Minimum level (inclusive).
  - Optional.
  - Default: 1

- --max <n>
  - Maximum level (inclusive).
  - Optional.
  - Default: 20

- --out-dir <path>
  - Output directory.
  - Optional.
  - Default: doc/balacing

- --help, -h
  - Print usage help.

### Mode behavior

Research mode:

- One research: single-axis chart.
- Multiple researches: dual-axis chart.
- Non-primary lines are scaled to intersect the primary line at level 1.

Variant mode:

- Single-axis chart for one research.
- Baseline can be included.
- Baseline line is solid.
- Variant lines are dashed.

### Output naming

Research mode output:

- techtree-progression-<researches>-l<min>-to-l<max>.svg

Variant mode output:

- techtree-variants-<variants-file-name>-l<min>-to-l<max>.svg

## Command examples

Single research, defaults to levels 1..20:

- npm run techtree-chart -- --research repairSpeed

Two researches with custom range:

- npm run techtree-chart -- --research shipSpeed --research teleportRechargeSpeed --min 1 --max 30

Multiple researches:

- npm run techtree-chart -- --research shipSpeed --research ironCapacity --research repairSpeed --min 1 --max 25

Using key/value mix and short flags:

- npm run techtree-chart -- -r ShipSpeed -r teleportRechargeSpeed --min 1 --max 25

Custom output directory:

- npm run techtree-chart -- --research repairSpeed --out-dir doc/balacing/custom

Variant file mode:

- npm run techtree-chart -- --variants-file doc/balacing/experiments/repair-speed-growth.json --min 1 --max 30

Print help:

- npm run techtree-chart -- --help

## Variants file format

Example file:
[doc/balacing/experiments/repair-speed-growth.json](doc/balacing/experiments/repair-speed-growth.json)

Schema:

- research: string (required)
  - Research key/value to modify, for example repairSpeed

- includeBaseline: boolean (optional)
  - Default: true

- variants: array (required)
  - Each item supports:
    - id: string (required)
    - label: string (optional)
    - baseValueIncrease: object (optional)
      - type: constant | factor | polynomial | valueExponent | valueQuadratic
      - value: number
    - baseValue: number (optional)
    - baseUpgradeCost: number (optional)
    - baseUpgradeDuration: number (optional)
    - upgradeCostIncrease: number (optional)
    - level: number (optional)
    - unit: string (optional)

### Full JSON example

{
"research": "repairSpeed",
"includeBaseline": true,
"variants": [
{
"id": "factor-1.10",
"label": "Repair Speed factor 1.10",
"baseValueIncrease": {
"type": "factor",
"value": 1.1
}
},
{
"id": "factor-1.20",
"label": "Repair Speed factor 1.20",
"baseValueIncrease": {
"type": "factor",
"value": 1.2
}
},
{
"id": "polynomial-0.22",
"label": "Repair Speed polynomial 0.22",
"baseValueIncrease": {
"type": "polynomial",
"value": 0.22
}
}
]
}

## Notes

- Output format is SVG.
- If the output directory does not exist, it is created automatically.
- If level 1 is not part of the chosen range in dual-axis mode, scaling still uses each line's first available point for robustness.
