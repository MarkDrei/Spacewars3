# Architecture Documentation TODO

## Progress Tracking

### Phase 1: Leaf Packages (Bottom-Up)
- [ ] Document `src/shared/src/utils` (leaf)
- [ ] Document `src/shared/src/types` (leaf)
- [ ] Document `src/shared/tests` (leaf)
- [ ] Document `src/lib/server/types` (leaf)
- [ ] Document `src/lib/client/data/worlds` (leaf)
- [ ] Document `src/lib/client/debug` (leaf)
- [ ] Document `src/lib/client/game` (leaf)
- [ ] Document `src/lib/client/hooks` (leaf)
- [ ] Document `src/lib/client/renderers` (leaf)
- [ ] Document `src/lib/client/services` (leaf)
- [ ] Document `src/components/Layout` (leaf)
- [ ] Document `src/components/Navigation` (leaf)
- [ ] Document `src/components/StatusHeader` (leaf)
- [ ] Document `src/app/about` (leaf)
- [ ] Document `src/app/admin` (leaf)
- [ ] Document `src/app/factory` (leaf)
- [ ] Document `src/app/game` (leaf)
- [ ] Document `src/app/home` (leaf)
- [ ] Document `src/app/login` (leaf)
- [ ] Document `src/app/profile` (leaf)
- [ ] Document `src/app/research` (leaf)
- [ ] Document `src/app/api/admin/database` (leaf)
- [ ] Document `src/app/api/build-item` (leaf)
- [ ] Document `src/app/api/build-status` (leaf)
- [ ] Document `src/app/api/collect` (leaf)
- [ ] Document `src/app/api/collect-typed` (leaf)
- [ ] Document `src/app/api/complete-build` (leaf)
- [ ] Document `src/app/api/login` (leaf)
- [ ] Document `src/app/api/logout` (leaf)
- [ ] Document `src/app/api/messages` (leaf)
- [ ] Document `src/app/api/navigate` (leaf)
- [ ] Document `src/app/api/navigate-typed` (leaf)
- [ ] Document `src/app/api/register` (leaf)
- [ ] Document `src/app/api/session` (leaf)
- [ ] Document `src/app/api/ship-stats` (leaf)
- [ ] Document `src/app/api/tech-catalog` (leaf)
- [ ] Document `src/app/api/techtree` (leaf)
- [ ] Document `src/app/api/trigger-research` (leaf)
- [ ] Document `src/app/api/user-stats` (leaf)
- [ ] Document `src/app/api/world` (leaf)

### Phase 2: Parent Packages
- [ ] Document `src/shared/src` (contains types, utils)
- [ ] Document `src/shared` (contains src, tests)
- [ ] Document `src/lib/client/data` (contains worlds)
- [ ] Document `src/lib/client` (contains data, debug, game, hooks, renderers, services)
- [ ] Document `src/lib/server` (contains types, and server files)
- [ ] Document `src/lib` (contains client, server)
- [ ] Document `src/components` (contains Layout, Navigation, StatusHeader)
- [ ] Document `src/app/api/admin` (contains database)
- [ ] Document `src/app/api` (contains all API routes)
- [ ] Document `src/app` (contains about, admin, api, factory, game, home, login, profile, research, and app files)

### Phase 3: Root Documentation
- [ ] Document `src` (top-level package)
- [ ] Create `doc/overview.md` (project overview)

## Documentation Structure

Each document should contain:
1. **Name + Overview description**
2. **Responsibilities**
3. **Decomposition** (with PlantUML diagram if applicable)
   - Links to sub-documents
   - Links to important source files
4. **Rationale** (or "n/a")
5. **Constraints, assumptions, consequences, known issues** (or "n/a")
6. **Details** (file-by-file analysis with top 5 collaborations)

## Files to Create
Total leaf packages: 44
Total parent packages: 11
Total documents: 56 (55 packages + 1 overview)
