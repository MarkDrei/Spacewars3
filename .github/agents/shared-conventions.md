# Shared Agent Conventions

This document defines cross-cutting concerns and conventions used by all agents in the development workflow.

## Knowledge Sharing: learnings.md

### Purpose

`doc/learnings.md` is the shared knowledge base for capturing insights between agents across sessions. It enables continuity and prevents rediscovering the same patterns.

### What to Document

✅ **Include:**

- **Code patterns and architectural conventions** discovered in the codebase
- **Non-obvious project structure insights** (e.g., "All API routes use iron-session for authentication")
- **Testing patterns and frameworks** used (e.g., "Tests use Vitest with database transactions for isolation")
- **Build/deployment quirks** or requirements (e.g., "Must use ES Modules exclusively, no CommonJS")
- **Integration patterns** between components (e.g., "Client-server communication uses typed API responses")
- **Performance considerations** discovered during implementation
- **Common pitfalls avoided** (e.g., "Don't modify state directly in React components, use hooks")
- **Environment setup peculiarities** (e.g., "PostgreSQL connection requires specific env vars")
- **Lock ordering conventions** for IronGuard TypeScript Locks to prevent deadlocks

❌ **Don't Include:**

- Task-specific implementation details that won't be reused
- One-off fixes or temporary workarounds
- Information already documented in Arc42 architecture docs
- Trivial or obvious observations
- Duplicate information already in the file

### When to Update

**Cartographer**: After discovering important patterns during research phase
**Knight**: After implementation if discovered reusable patterns or conventions
**Medicus**: After review if found testing or quality insights worth sharing
**Navigator**: After plan refinement if discovered planning patterns
**High Commander**: If orchestration insights emerge during workflow

### Format

```markdown
## [Topic/Pattern Name]

**Discovered by**: [Agent name]  
**Context**: [When/why this is relevant]  
**Details**: [The actual learning with examples if helpful]
```

---

## Arc42 Documentation Guidelines

### When to Update Arc42 Documentation

Arc42 documentation lives in `/doc/architecture` and should only be updated for **architecturally significant changes**.

✅ **Update Arc42 for:**

- New architectural layer or component
- Significant pattern changes (e.g., moving from REST to WebSockets)
- New external dependencies or integrations
- Major technology decisions (e.g., adopting GraphQL)
- Changes to system context or interfaces
- New quality requirements affecting architecture

❌ **Don't Update Arc42 for:**

- Adding a new service class within existing architecture
- Refactoring within existing components
- Minor bug fixes or code cleanup
- Adding individual methods or functions
- Implementation details of existing components

### Arc42 Update Principles

- **Keep documentation abstract** - focus on major building blocks, not implementation
- **Avoid over-documentation** - resist documenting every class or method
- **Update relevant sections only** - don't rewrite entire document
- **Be concise** - architecture documentation should be scannable
- **Visualize** where helpful - use Mermaid diagrams to visualize components or layers

---

## TypeScript/Next.js Standards

All TypeScript code in this project follows these standards:

### Code Style

- **TypeScript strict mode** enabled
- **Type annotations** for function parameters, return types, and complex variables
- **camelCase** for variables, functions, and methods
- **PascalCase** for classes, interfaces, types, and React components
- **UPPER_CASE** for constants
- **Prefix interfaces with 'I'** only when necessary for clarity (not mandatory)

### Modern TypeScript Features

- Use **type inference** where obvious
- Use **interfaces** for object shapes, **types** for unions/intersections
- Use **generics** for reusable type-safe components
- Use **type guards** and **discriminated unions** for safe type narrowing
- Use **const assertions** for literal types
- Use **utility types** (`Partial`, `Pick`, `Omit`, `Record`, etc.)

### Next.js 15 Conventions

- **App Router** for all routing (`src/app/` directory)
- **Server Components** by default, use `'use client'` only when needed
- **API Routes** in `src/app/api/`
- **Server-side logic** in `src/lib/server/` (database, authentication, business logic)
- **Client-side logic** in `src/lib/client/` (hooks, services, game engine)
- **Shared utilities** in `src/shared/` (types, constants, utilities)

### Module System

- **ES Modules exclusively** (`import`/`export` only)
- **NO CommonJS** (`require`, `module.exports`) - this is enforced
- Use **named exports** for utilities, **default exports** for React components

### Code Quality Principles

- **SOLID principles** - especially Single Responsibility
- **Composition over inheritance** where appropriate
- **Small, focused functions** - prefer functions under 30 lines
- **Minimal comments** - write self-documenting code
- **DRY principle** - don't repeat yourself
- **Immutability** - avoid mutating state directly

### IronGuard TypeScript Locks

- **Use typed locks** for compile-time deadlock prevention
- **Consistent lock ordering** across the codebase
- **Document lock hierarchies** in code comments
- **Prefer fine-grained locks** over coarse-grained locks
- **Always release locks** in finally blocks or using proper utilities

### Testing Standards

- **Vitest** as the testing framework
- **jsdom** for React component testing
- **Comprehensive coverage** - aim for >80% code coverage
- **Test structure**: Arrange, Act, Assert pattern
- **Test naming**: `whatIsTested_scenario_expectedOutcome`
- **Use transactions** for database test isolation
- **Mock external dependencies** appropriately
- **Test behavior**, not implementation details

---

## Development Plan Structure

All development plans follow this hierarchical structure and are saved to `doc/development-plan.md`:

### Hierarchy

```
Vision (Top Level)
  └─ Goals (Mid Level)
       ├─ Sub-Goals (optional nesting)
       └─ Tasks (Leaf Level - actionable items)
```

### Section Definitions

**Vision**: High-level description of overall objective (can be a user story)

**Goals**: Break down Vision into concrete goals

- Textual description or user story
- Optional: Inputs, Outputs, Quality Requirements
- Can be hierarchically nested with sub-goals

**Tasks**: Low-level actionable items (leaf nodes only)

- **Action**: Specific description of what to do
- **Files**: Files to create or modify (proposals, can be adjusted)
- **Inputs** (optional): Required data or dependencies
- **Outputs** (optional): Generated artifacts
- **Quality Requirements** (optional): Standards to meet
- **Arc42 Updates** (optional): Whether Arc42 documentation updates are required

**Dependencies**: npm packages needed

**Arc42 Documentation Updates**: List of sections to update (or "None")

**Architecture Notes**: Key decisions, patterns, TypeScript features to use

**Agent Decisions**: Decisions made by Cartographer during planning

**Open Questions**: Only in draft plans - removed by Navigator during finalization

### Task Completion Format

When a task is completed, Knight adds:

```markdown
**Status**: ✅ COMPLETED  
**Implementation Summary**: [1-2 sentence description]  
**Files Modified/Created**: [list with purposes]  
**Deviations from Plan**: [if any, with rationale]  
**Arc42 Updates**: [If required: "Updated /doc/architecture/[section].md" OR "None required"]  
**Test Results**: ✅ All tests passing, coverage [X]%, no linting errors
```

### Review Format

When a task is reviewed, Medicus adds:

```markdown
**Review Status**: ✅ APPROVED | ⚠️ NEEDS REVISION  
**Reviewer**: Medicus  
**Review Notes**: [feedback]
```

---

## Quality Requirements Baseline

These are the default quality standards unless a task specifies otherwise:

### Code Quality

- ESLint compliance (no errors)
- TypeScript strict mode compliance (no type errors)
- No code duplication
- Proper error handling with specific error types
- Resource cleanup (proper async/await patterns, cleanup in useEffect)
- Thread safety considerations where applicable (especially with IronGuard locks)

### Testing

- Minimum 80% code coverage
- Tests cover: happy path, edge cases, error conditions
- Meaningful test names following convention: `whatIsTested_scenario_expectedOutcome`
- Tests are maintainable and readable
- Database tests use transactions for isolation

### Documentation

- JSDoc comments for public APIs and complex functions
- Complex logic has explaining comments
- README updates for new features
- Arc42 updates for architectural changes (see guidelines above)

### Performance

- No obvious performance issues (unnecessary loops, N+1 queries, etc.)
- Appropriate data structures for use case
- Consider lazy loading where appropriate
- Optimize bundle size (dynamic imports for large dependencies)

---

## Git Commit Standards

All commits should follow this format:

### Commit Message Format

```
Task [task_number]: [brief_description]
```

**Examples:**

- `Task 1.1.1: Implement UserService class with CRUD operations`
- `Task 2.3.2: Add unit tests for authentication flow`
- `Finalized development plan with human review feedback`

### Special Commits (Non-Task)

- Plan finalization: `Finalized development plan with human review feedback`
- Plan archival: `Archive completed plan: [short description]`
- Documentation: `Update Arc42 architecture documentation`

---

## Medicus Review Focus

Medicus is a **design and architecture reviewer**, not an automated test runner.

### What Medicus Reviews (Design & Architecture)

**Knight guarantees** all automated checks passed (tests, linting, coverage). Medicus focuses on what tools CANNOT detect:

✅ **Design Quality:**

- SOLID principles adherence
- Appropriate design patterns
- Coupling and cohesion
- Abstraction levels

✅ **Code Duplication:**

- Search for similar logic in codebase
- Refactoring opportunities

✅ **Business Logic:**

- Correctness (solves the RIGHT problem)
- Edge cases coverage
- Error handling appropriateness

✅ **Architecture:**

- Alignment with overall system design
- Consistency with established patterns
- Future maintainability

✅ **Test Meaningfulness:**

- Do tests validate behavior or just chase coverage?
- Are important scenarios tested?
- Are tests maintainable?

✅ **Arc42 Updates:**

- If required, are they accurate and follow guidelines?
- Are they appropriately abstract?

### What Medicus Does NOT Review (Automated)

❌ **Don't Focus On:**

- Re-running tests (Knight already did this)
- Checking ESLint compliance (linters caught this)
- Test coverage percentage (Knight verified this)
- Syntax errors (Knight wouldn't have succeeded)
- Build success (Knight already verified)

### Contract Between Knight and Medicus

**Knight promises**: All automated checks passed (tests, linting, build, coverage)
**Medicus trusts**: Knight's work and focuses on design/architecture review only

---

## Common Patterns and Conventions

### API Route Patterns

- Use Next.js Route Handlers in `src/app/api/[route]/route.ts`
- Validate session using iron-session
- Return typed JSON responses
- Handle errors with appropriate HTTP status codes

### Authentication Pattern

- Use iron-session for session management
- Store userId and username in session
- Protected routes check session validity
- Redirect to login if not authenticated

### Database Pattern

- Use PostgreSQL with prepared statements
- Use transactions for multi-step operations
- Use database isolation in tests (transactions)
- Connection pooling via singleton pattern

### React Component Pattern

- Server Components by default
- Client Components only when needed (interactivity, hooks, browser APIs)
- Custom hooks for shared client-side logic
- Props validation with TypeScript interfaces

### Testing Pattern

- Arrange-Act-Assert structure
- Use Vitest fixtures for shared setup
- Database tests use transactions for isolation
- Mock external dependencies with vi.mock()

---

## Error Handling Standards

### Client-Side

- Use try-catch for async operations
- Display user-friendly error messages
- Log errors to console in development
- Consider error boundaries for React components

### Server-Side

- Use typed errors (custom Error classes)
- Return appropriate HTTP status codes (400, 401, 403, 404, 500)
- Log errors with context
- Don't expose sensitive information in error messages

### API Routes

- Validate input before processing
- Return consistent error response format
