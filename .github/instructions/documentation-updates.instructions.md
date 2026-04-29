---
description: "Use when updating doc/functional-requirements.md or doc/architecture/*.md. Covers separation of concerns, proof requirements, and contradiction handling."
applyTo: "doc/**"
---

# Documentation Updates — Functional Requirements & Architecture

This instruction defines the separation of concerns, verification standards, and conflict resolution rules for maintaining Spacewars documentation.

## Separation of Concerns

### ✓ Belongs in `doc/functional-requirements.md`

- **User-visible requirements**: What players/admins can do and see
- **Feature definitions**: Capability descriptions, features, requirements with WHY and WHAT
- **Cross-references**: Links to capabilities, features, related requirements
- **API endpoint references** (minimal): Only API paths mentioned within requirement context (e.g., "POST /api/harvest" in a harvesting requirement)
- **Business constraints**: Limits, rules, progression rules (e.g., "combat restricted to level-matched players")

### ✓ Belongs in `doc/architecture/arc42-architecture.md`

- **Technical implementation details**: Stack, databases, frameworks, libraries
- **System design**: Cache systems, lock hierarchies, caching strategies
- **Architectural patterns**: Decision records, trade-offs, rationale
- **Infrastructure**: Deployment, monitoring, scaling
- **Glossary**: Technical terms, legacy term mappings (e.g., "Messages" → "Notifications")
- **API endpoint details**: Full request/response specs, parameters, error codes
- **Code organization**: Module structure, component responsibilities, repository patterns

### ✗ Never in either document

- **Assumptions** ("probably works like", "usually does", "most systems")
- **"How it is" without proof** (e.g., "iron regenerates at 1/sec" without reading code)
- **Unverified future plans** (only documented requirements that are **implemented and realized**)
- **Personal opinions or aspirational statements** (use neutral, PRD tone)

## Internationalization Documentation Rules

- **Functional requirements:** Document player-visible language switching, translated UI availability, and locale-specific notifications in `doc/functional-requirements.md`.
- **Architecture:** Document `next-intl` wiring, locale resolution, cookie/database persistence, and locale catalog structure in `doc/architecture/arc42-architecture.md`.
- **Proof sources:** Verify multilingual behavior in `src/i18n/routing.ts`, `src/i18n/request.ts`, `src/app/api/set-locale/route.ts`, `src/lib/server/i18n/serverTranslations.ts`, and `src/locales/*.json` before documenting it.
- **Change discipline:** When documentation mentions newly added UI text or notifications, ensure the English and German catalogs stay aligned with implementation.

## Verification Standards

### Before Adding a Requirement

1. **Verify from code** (in priority order):
   - Read the relevant implementation if accessible
   - Check API signatures in route files (`src/app/api/**`)
   - Read tests for expected behavior patterns
   - Review component/hook implementations

2. **Link to proof**: Every requirement SHALL include one of:
   - API endpoint reference: `POST /api/harvest` (verified in `src/app/api/harvest/route.ts`)
   - Component reference: `StatusHeader.tsx` (where defense display is implemented)
   - Configuration key: `IRON_REGEN_RATE` (if stored as env var or constant)
   - Test file reference: `src/__tests__/unit/updateStats.test.ts` (where behavior is tested)

3. **If code contradicts documentation**:
   - **In autonomous mode**: Trust the code. Update the requirement to match implementation.
   - **In interactive mode**: Ask the user: "Code shows [behavior], but docs say [behavior]. Which is current truth?"

4. **If unsure or unclear**:
   - **Ask the user** before documenting
   - Example: "I see `defense_current` set to `max/2` in code, but is this a temporary hardcoded value or intentional design?"

### Requirement Statement Quality

- **WHAT**: [Actor] [action] [result]. Example: "Player can assign a commander to a bridge slot."
- **WHY**: Business reason in context. Example: "Assigned commanders provide stat bonuses."
- **Link proof**: Reference implementation source.

✓ **Good example:**

```
Cap08_Feat001_Req001: Player can assign a commander from inventory to an available bridge slot.
[Why]: Bridge-slot assignment enables commanders' stat bonuses.
[Implementation reference]: InventoryService.assignCommander() in src/lib/server/inventory/InventoryService.ts
```

✗ **Bad example:**

```
Cap08_Feat001_Req001: The system manages commanders.
[Why]: It's how the game usually works.
[Implementation reference]: (none provided)
```

## Cross-Document Navigation

### Referencing functional-requirements.md from arc42

- Use anchor links: `[Cap03: Exploration & Navigation](../functional-requirements.md#cap03-exploration--navigation)`
- Keep minimal—link only when architectural pattern directly relates to requirement

### Referencing arc42 from functional-requirements.md

- Use anchor links: `See [Arc42 Building Block View](./architecture/arc42-architecture.md#5-building-block-view) for cache architecture`
- Use sparingly—functional doc should not require reading arc42 to understand requirements

## Editing Workflow

When updating requirements:

1. **Extract from code** (never assume):
   - Open relevant implementation or test
   - Verify behavior matches requirement
   - Extract exact limits, constraints, conditions

2. **Classify destination**:
   - User-facing? → functional-requirements.md
   - Technical/design? → arc42-architecture.md
   - Term definition? → arc42 Glossary

3. **Use templates**: Follow the templates in doc/functional-requirements.md § Document Format & Templates

4. **Cross-link both directions**:
   - Requirements link to related capabilities/features
   - Features link to implemented APIs or components
   - Glossary entries link to related concepts

5. **Mark status** (when applicable):
   - **Realized**: Fully implemented and verified in code
   - **Partial**: Some features implemented; document what exists
   - **Planned**: Only if explicitly marked as future work (rare in this doc—focus on realized)

## Tone & Language

- **PRD style**: Direct, factual, no marketing language ("The world wraps at boundaries" not "the universe wraps seamlessly")
- **Active voice preferred**: "Players navigate worlds" not "worlds are navigable by players"
- **Precise constraints**: "Iron regenerates 1 per second" (not "over time")
- **Neutral terminology**: "Notifications" (not legacy "messages")
- **Consistent names**: Use the glossary for term definitions; use consistent names throughout

## Technical Debt Tracking

Any architectural, implementation, or testing issues discovered during documentation work should be added to [doc/TechnicalDebt.md](../../doc/TechnicalDebt.md).

**When to add an issue:**

- **Incomplete feature**: Code has a known limitation or temporary workaround
- **Missing test**: Functionality is implemented but not covered by tests
- **Database migration pending**: Backward compatibility fallback in place that needs cleanup
- **Lock or cache issue**: Architecture violation or potential deadlock/consistency problem
- **Balance or performance concern**: Feature works but has unintended side effects
- **Missing documentation**: Implementation exists but behavior is not clearly documented

**Structure of a TechnicalDebt entry:**

```markdown
## [Feature Name or Issue Title]

**Priority**: [Low|Medium|High]
**Added**: [Date YYYY-MM-DD]
**Component**: [File path or system name]

### Context

[Description of what exists and why it's a problem]

### Consequences

[Impact or why this matters]

### Proper Solution

[How to fix it, if known]

### Related Files

- `path/to/file.ts` — component description
```

**Do not confuse TechnicalDebt with functional requirements:** An issue belongs in TechnicalDebt if it describes a _limitation of the current implementation_ or _work that remains to be done_, not a feature that should be documented in functional-requirements.md.

## Questions to Ask Before Documenting

1. **"Is this implemented or planned?"** → If planned, skip it (or mark explicitly as "planned").
2. **"Can I verify this in code/API/tests?"** → If no, ask the user.
3. **"Does this contradict existing requirement?"** → If yes, ask which is correct.
4. **"Is this business logic or implementation detail?"** → If implementation, move to arc42.
5. **"Does a separate glossary entry exist for this term?"** → If not, suggest adding it to arc42 Glossary.
6. **"Is this a known limitation or incomplete feature?"** → If yes, add to doc/TechnicalDebt.md instead.
