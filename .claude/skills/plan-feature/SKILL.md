---
name: plan-feature
description: Research the codebase and write a hierarchical development plan (Vision → Goals → Tasks) for a new Spacewars feature, clarifying open questions with the user. Planning only, no implementation. Equivalent of the Copilot Cartographer + Navigator agents.
---

# Plan a feature

Source of truth for the process and the plan format:
- `.github/agents/cartographer.agent.md` (discovery, drafting, plan structure)
- `.github/agents/navigator.agent.md` (finalizing a plan after human feedback)
- `.github/agents/shared-conventions.md` (plan structure, learnings.md, Arc42 rules)

Read those files first and follow them, with these Claude Code mappings:
- `runSubagent` → `Agent` tool (use `Explore` for read-only research).
- `askQuestions` → `AskUserQuestion` tool (batch questions, give a recommendation).
- `todo` → task list tools.

Key rules:
- Read `doc/learnings.md` and `doc/architecture/arc42-architecture.md` before drafting.
- Save the plan as `doc/development-plan-<task-name>.md`; record your own decisions in "Agent Decisions".
- Do NOT edit source code. Stop after the plan is saved and ask the user for review.
- When the user has answered the open questions, finalize the plan (Navigator step) so it has no open
  questions left. Finished plans are later moved to `doc/completed-plans/YYYY-MM-<name>.md`.
