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
```

- Only commit / open a PR when `npm run ci:local` passes. If it fails, fix the cause; never skip or weaken checks.
- Report the result (pass/fail with output) in the PR description.
- PRs target `master`.

## Further conventions

- Code quality standards, review criteria and the `doc/learnings.md` knowledge base are described in `.github/agents/shared-conventions.md`. Read it when doing larger features or reviews.
- `.github/agents/*.agent.md` describe a Copilot multi-agent workflow (planning, implementation, review). They are reference material, not mandatory steps for Claude Code.
