---
name: run-ci
description: Run the full local quality gate (lint, typecheck, Vitest incl. Postgres integration tests, Next.js build) and report results. Use before every commit/PR, or when asked to "check if everything is green".
---

# Run the CI quality gate

Mirrors `.github/workflows/test.yml` and the Copilot `Tester` agent (`.github/agents/tester.agent.md`).
Only report — do not fix failures unless the user asked for that.

1. Check that PostgreSQL is reachable on `localhost:5432`:
   `docker ps --filter name=spacewars3-db --format '{{.Names}} {{.Status}}'`
   - Running → use `npm run ci` (lint + typecheck + test:ci + build).
   - Not running → use `npm run ci:local` (starts the `db` service via `docker compose up --wait db` first).
2. Run it with output captured to a log file in the scratchpad (the run takes several minutes; use a
   background command and wait for completion instead of polling).
3. Report per stage: lint, typecheck, tests (files / tests passed / failed / skipped, duration), build.
   Quote the exact error output for any failure and name the failing test with `file:line`.
4. Warnings (lint, Next.js build) are listed separately — they do not fail CI but are worth noting.

Never use `npm run test:ui` or `npm run test:watch` — they are interactive and hang.
