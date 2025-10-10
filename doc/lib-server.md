# lib/server Package

## Overview
Server-side business logic, database operations, and domain models. Handles SQLite persistence, authentication, and game state management with typed lock concurrency control.

## Responsibilities
- Database management (SQLite)
- Domain models (User, World) and repositories
- Research and technology systems
- Typed lock concurrency control
- Session management

## Files

**Database:** database.ts, schema.ts, migrations.ts, seedData.ts  
**Repositories:** userRepo.ts, worldRepo.ts, techRepo.ts, messagesRepo.ts  
**Domain:** user.ts, world.ts, techtree.ts, TechFactory.ts  
**Infrastructure:** typedLocks.ts, typedCacheManager.ts, session.ts, serverSession.ts, errors.ts

## Key Patterns

- **Server-Authoritative:** Server validates all game state
- **Typed Locks:** Compile-time deadlock prevention (GameLock → UserLock → TechLock order)
- **Repository Pattern:** Separate data access from business logic
- **Domain Models:** User and World classes with business logic

## File Details

### Database Layer

**database.ts** - SQLite connection management, initialization, test/prod DB separation  
**schema.ts** - Table definitions (users, space_objects, tech_counts, build_queue, messages)  
**migrations.ts** - Schema evolution and versioning  
**seedData.ts** - Default data for initialization (default user, space objects)

### Repository Layer

**userRepo.ts** - User CRUD operations, load with tech tree  
**worldRepo.ts** - Space object CRUD, batch updates  
**techRepo.ts** - Tech counts and build queue management  
**messagesRepo.ts** - Message persistence

### Domain Layer

**user.ts** - User domain model with iron calculation, research progress, stat updates  
**world.ts** - World physics, collision detection, toroidal wrapping  
**techtree.ts** - Research system (IronHarvesting, ShipSpeed), tech tree state, progression  
**TechFactory.ts** - Tech specifications, defense value calculations, weapon/defense catalog

### Infrastructure

**typedLocks.ts** - Type-safe lock system with compile-time ordering enforcement
```typescript
// Correct order enforced by types
await withLocks(['GameLock', 'UserLock'], async () => { ... });
```

**typedCacheManager.ts** - In-memory cache with optional DB persistence  
**session.ts** - iron-session configuration (cookies, TTL)  
**serverSession.ts** - Auth utilities (getServerAuthState, requireAuth)  
**errors.ts** - Custom error types (NotFoundError, ValidationError, AuthenticationError)
