---
name: implement-task
description: Implement one task (or the next open task) from a doc/development-plan-*.md file, with tests, quality gate and plan progress update. Equivalent of the Copilot Knight agent; use the High Commander flow for multi-task plans.
---

# Implement a plan task

Source of truth: `.github/agents/knight.agent.md` (implementation) and
`.github/agents/highCommander.agent.md` (task sequencing, when and how to review/commit).
Read both plus `.github/agents/shared-conventions.md` before starting.

Claude Code mappings: `runSubagent` → `Agent` tool; reviews → the `design-review` skill.

Checklist:
1. Read the whole plan file and pick the requested task (or the first unchecked one).
2. Read related code, `doc/learnings.md` and the relevant Arc42 sections. Respect the IronGuard lock
   ordering (see `doc/architecture/building-blocks-cache-systems.md`).
3. Implement in TypeScript/ESM; keep client / server / shared separation; update `src/locales/en.json`
   and `de.json` together for any user-facing text.
4. Add tests in the correct folder (`unit/` preferred, `integration/` only when DB is required, wrapped in
   `withTransaction`); names follow `whatIsTested_scenario_expectedOutcome`.
5. Run the `run-ci` skill. Only continue when it is green.
6. Tick the task in the plan, add a short implementation summary, add reusable insights to
   `doc/learnings.md` and known limitations to `doc/TechnicalDebt.md`.
7. Commit only when the user asked; never push to `master` (that deploys live).
