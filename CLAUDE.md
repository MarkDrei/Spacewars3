# CLAUDE.md

The project instructions live in `.github/` (shared with GitHub Copilot). They are imported here so Claude Code follows the same rules.

## Project instructions

@.github/copilot-instructions.md

## Test instructions (apply to `src/__tests__/**`)

@.github/instructions/TESTING.instructions.md

## Documentation instructions (apply to `doc/**`)

@.github/instructions/documentation-updates.instructions.md

## Quality gate before every commit / pull request

The CI pipeline (`.github/workflows/test.yml`) runs lint, typecheck, tests and build. Run the same checks locally before committing or opening a PR:

```bash
npm run ci:local   # lint + typecheck + test:local (starts Postgres via Docker) + build
npm run ci         # same, when Postgres already runs on localhost:5432 (VPS: container spacewars3-db-1)
```

- Only commit / open a PR when `npm run ci:local` passes. If it fails, fix the cause; never skip or weaken checks.
- Report the result (pass/fail with output) in the PR description.
- PRs target `master`.

## Further conventions

- Code quality standards, review criteria and the `doc/learnings.md` knowledge base are described in `.github/agents/shared-conventions.md`. Read it when doing larger features or reviews.
- `.github/agents/*.agent.md` describe a Copilot multi-agent workflow (planning, implementation, review). They are reference material, not mandatory steps for Claude Code.
- Concurrency: server caches use IronGuard TypeScript Locks with a fixed lock hierarchy — read `doc/architecture/building-blocks-cache-systems.md` before touching caches or locks.
- Toolchain: Next.js 16 with Turbopack (service worker via Serwist: `src/app/sw.ts`, served by `src/app/serwist/[path]/route.ts`), ESLint 10 via `eslint .`, TypeScript 7 for `npm run typecheck` (`tsc`) plus TypeScript 6 as `typescript` package (API for typescript-eslint, `tsc6` for `next build`). This is intentional — see `doc/TechnicalDebt.md`.
- Before larger work, skim `doc/learnings.md` (shared knowledge base) and `doc/TechnicalDebt.md`.

## Claude Code skills (`.claude/skills/`)

Thin wrappers that map the Copilot agents to Claude Code. The `.github/` files stay the single source of truth.

| Skill | Copilot equivalent | Use for |
| --- | --- | --- |
| `run-ci` | Tester | Full quality gate (lint, typecheck, tests, build) + report |
| `plan-feature` | Cartographer + Navigator | Research and write `doc/development-plan-*.md` (no code) |
| `implement-task` | Knight (+ High Commander flow) | Implement one plan task with tests and CI |
| `design-review` | Medicus | Design/architecture review of the branch diff |
| `test-pyramid-cleanup` | Cleaner | Move integration tests to unit/ui where safe |
| `update-docs` | documentation-updates instructions | Functional requirements, Arc42, TechnicalDebt |
