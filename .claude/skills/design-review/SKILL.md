---
name: design-review
description: Review the current branch's changes for design, architecture alignment, duplication, test meaningfulness and business-logic correctness (what lint/tests cannot catch). Equivalent of the Copilot Medicus agent.
---

# Design & architecture review

Source of truth: `.github/agents/medicus.agent.md` (review criteria, report format) and the
"Code Quality Standards / Review" sections of `.github/agents/shared-conventions.md`. Read both first.

Scope: `git diff master...HEAD` plus uncommitted changes (or the target the user names).

Focus on:
- Architecture fit: client / server / shared separation, cache + IronGuard lock hierarchy, ESM only.
- Duplication against existing code (search for similar helpers before accepting new ones).
- Tests: do they assert behaviour, are they in the right pyramid layer, do integration tests use
  `withTransaction`?
- i18n: en/de catalogs aligned for any new text.
- Docs: functional requirements / Arc42 / TechnicalDebt updated where behaviour changed.

Report findings ranked by severity with `file:line`, and a clear verdict (approve / changes needed).
Trust that automated checks ran; only re-run them if you have a concrete reason to doubt them.
For pure bug hunting, the built-in `/code-review` skill is an alternative.
