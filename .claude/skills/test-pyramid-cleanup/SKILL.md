---
name: test-pyramid-cleanup
description: Move integration tests that do not really need Postgres/caches into unit/ or ui/, one file at a time, tracking progress in doc/test-file-index.md. Equivalent of the Copilot Cleaner agent.
---

# Test pyramid cleanup

Source of truth: `.github/agents/cleaner.agent.md` (loop, annotation tags, sub-agent prompt).
Also read `.github/instructions/TESTING.instructions.md` and `doc/test-mocking-patterns.md`.

Claude Code mapping: the per-file analysis sub-agent → `Agent` tool (general-purpose), one file per run.

Rules: never weaken assertions to make a test "unit"; after each file run the affected vitest
projects (`npx vitest run src/__tests__/unit/` etc.) and record the annotation in the work log.
If `doc/test-file-index.md` does not exist, generate it first as described in the Cleaner agent.
