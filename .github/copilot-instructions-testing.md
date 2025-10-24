# Testing Commands - AI Copilot Instructions

## ⚠️ Critical Rule: Avoid Interactive Test Commands

**NEVER** use commands that require manual input (like pressing 'q' to quit). These will hang in automated environments.

## ❌ Commands to AVOID
- `npm test -- --watch`
- `npm run test:ui` 
- `vitest --ui`
- `npm run test:watch`
- Any command with `--watch`, `--ui`, or interactive flags

## ✅ Safe Commands to USE
- `npm test` - Runs all tests once and exits
- `vitest run` - Direct non-interactive test run
- `npm test -- --coverage` - Run with coverage
- `npm test -- src/__tests__/api/` - Run specific directory

## Simple Rule
If a command mentions "watch", "ui", or "interactive" → **DON'T USE IT**