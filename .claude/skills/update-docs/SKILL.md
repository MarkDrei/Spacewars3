---
name: update-docs
description: Update doc/functional-requirements.md, doc/architecture/arc42-architecture.md and doc/TechnicalDebt.md from verified code behaviour. Use after a feature lands or when docs drift from code.
---

# Update project documentation

The rules are in `.github/instructions/documentation-updates.instructions.md` (already imported via
CLAUDE.md). Short version:

- User-visible behaviour → `doc/functional-requirements.md` (use its templates, Cap/Feat/Req IDs).
- Technical design, caches, locks, API details, glossary → `doc/architecture/arc42-architecture.md`.
- Limitations / workarounds / missing tests → `doc/TechnicalDebt.md` (dated entry, template in the rules).
- Every statement must be verified in code and carry an implementation reference. No assumptions.
- Code contradicts docs → ask the user (interactive) or trust the code (autonomous).
