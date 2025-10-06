# lib Package

## Overview
Contains all application business logic, split into client-side and server-side packages. This is the core of the application, implementing game mechanics, data management, rendering, and all non-UI functionality. Serves as the foundation that the Next.js app layer builds upon.

## Responsibilities
- Implement all game business logic
- Provide client-side and server-side separation
- Handle data persistence and retrieval
- Manage game state and synchronization
- Implement rendering and visualization
- Provide API integration layer
- Handle authentication and authorization
- Manage concurrency and caching

## Decomposition

```plantuml
@startuml
package "lib" {
  package "client" {
    note "Browser-side logic\nGame engine\nRendering\nHooks\nServices"
  }
  
  package "server" {
    note "Node.js logic\nDatabase\nRepositories\nDomain models\nTyped locks"
  }
  
  client -down-> server : API calls
  server -up-> client : JSON responses
}

note bottom of lib
  Clear client-server separation
  Server is authoritative
  Client visualizes and interacts
end note
@enduml
```

### Sub-Packages

**See detailed documentation:**
- [client/](lib-client.md) - Client-side application logic
  - game/ - Game engine and entities
  - renderers/ - Canvas rendering
  - hooks/ - React state management
  - services/ - API communication
  - data/ - Static data files
  - debug/ - Debug utilities
  
- [server/](lib-server.md) - Server-side application logic
  - Database layer (database, schema, migrations, seedData)
  - Repository layer (userRepo, worldRepo, techRepo, messagesRepo)
  - Domain layer (user, world, techtree, TechFactory)
  - Infrastructure (typedLocks, typedCacheManager, session, errors)
  - types/ - Server-specific types

## Rationale

**Client-Server Separation:**
- **Clear boundaries**: Client and server responsibilities distinct
- **Security**: Business rules enforced on server
- **Testability**: Each side testable independently
- **Scalability**: Can scale client and server separately
- **Maintainability**: Changes localized to appropriate side

**Server-Authoritative Architecture:**
- **Single source of truth**: Server maintains canonical state
- **No cheating**: Client cannot manipulate game state
- **Consistency**: All clients see same authoritative state
- **Simplified client**: No complex state reconciliation
- **Easier debugging**: Clear source of state changes

**Package Organization:**
- **By layer** (client/server) not by feature
- **Clear dependencies**: Client depends on server via API
- **Shared code** separate (see shared package)
- **Horizontal slicing**: Each layer complete functionality

## Constraints, Assumptions, Consequences, Known Issues

**Assumptions:**
- Node.js server environment available
- Modern browser for client
- Network connectivity for client-server communication
- SQLite database for persistence

**Consequences:**
- Network latency affects user experience
- Server performance critical for all users
- Database is potential bottleneck
- Must handle offline/disconnected scenarios

**Constraints:**
- Client cannot directly access database
- Server cannot access browser APIs
- Must maintain API compatibility
- Type safety across boundaries

**Known Issues:**
- Polling-based sync (no WebSockets yet)
- Some code duplication between client and server (being addressed)

## Architecture Patterns

### Repository Pattern (Server)
```typescript
// Server: Repository abstracts database access
class UserRepo {
  async findById(id: number): Promise<User> {
    // Database query
  }
}

// Used by API routes
const user = await userRepo.findById(userId);
```

### Service Pattern (Client)
```typescript
// Client: Service abstracts API access
const authService = {
  async login(credentials) {
    // HTTP request
  }
};

// Used by hooks
const result = await authService.login({ username, password });
```

### Domain Model Pattern (Server)
```typescript
// Server: Rich domain objects with behavior
class User {
  updateStats(now: number): void {
    // Business logic
  }
  
  getIronPerSecond(): number {
    // Calculation
  }
}
```

### Hook Pattern (Client)
```typescript
// Client: Reusable state logic
export const useIron = () => {
  const [iron, setIron] = useState(0);
  
  useEffect(() => {
    // Polling and state management
  }, []);
  
  return { iron };
};
```

## Data Flow

### Client Request → Server Response
```
1. User action in browser
2. Client service calls API
3. Next.js API route receives request
4. Route uses repository to access database
5. Domain model applies business logic
6. Repository persists changes
7. Route returns JSON response
8. Client service processes response
9. Hook updates state
10. UI re-renders
```

### Server Poll from Client
```
1. Hook timer triggers
2. Service fetches data from API
3. Server loads from database
4. Domain model calculates current state
5. Server returns JSON
6. Hook updates local state
7. Client-side calculations until next poll
8. UI updates frequently
```

## Concurrency Control

**Server-Side:**
- Typed lock system prevents deadlocks
- Lock ordering enforced at compile time
- Protects concurrent access to shared resources

**Client-Side:**
- React's state management handles UI updates
- Event system for cross-component communication
- No complex concurrency (single-threaded JavaScript)

## Testing Strategy

**Client Tests:**
- Unit tests: Game logic, hooks (mocked), services (mocked)
- Integration tests: Hooks with test API
- Rendering tests: Visual validation

**Server Tests:**
- Unit tests: Domain models, pure functions
- Integration tests: Repositories with test database
- API tests: Full request/response cycle

**Shared Tests:**
- Physics calculations
- Type compatibility

## Performance Considerations

**Client:**
- 60fps rendering target
- Efficient canvas drawing
- Optimized polling intervals
- Client-side calculations between polls

**Server:**
- Database query optimization
- Caching frequently accessed data
- Efficient lock usage
- Batch operations where possible

## Security Considerations

**Client:**
- No sensitive data storage
- HTTP-only cookies for sessions
- Input validation before sending to server
- No business logic that could be exploited

**Server:**
- Authentication required for protected routes
- Authorization checks for operations
- Input validation and sanitization
- Business rule enforcement
- Secure password hashing (bcrypt)

## Deployment

**Client Code:**
- Bundled with Next.js
- Optimized and minified
- Code splitting for performance
- Served as static assets + hydration

**Server Code:**
- Runs in Node.js
- Next.js API routes
- Database file on server
- Environment-specific configuration

## Dependencies

**Client Dependencies:**
- React (hooks, components)
- Next.js (routing, rendering)
- Canvas API (rendering)

**Server Dependencies:**
- sqlite3 (database)
- bcrypt (password hashing)
- iron-session (session management)
- Next.js (API routes)

**Shared Dependencies:**
- TypeScript (type safety)
- ES Modules (modern imports)

## Integration with App Layer

**Client lib → App:**
- Hooks used by page components
- Game engine used by game page
- Services used by components

**Server lib → App:**
- Repositories used by API routes
- Domain models used by routes
- Session management used by routes

## Future Enhancements

**Potential Additions:**
- WebSocket support for real-time updates
- Service workers for offline support
- IndexedDB for client-side caching
- Redis for server-side caching
- Horizontal scaling with multiple servers

## Migration Path

**Current State:**
- Both regular and -typed API routes exist
- Gradual migration to typed locks
- Some legacy code marked with TODOs

**Future Direction:**
- Complete typed lock migration
- Remove legacy routes
- Consolidate duplicate code
- Implement WebSocket layer
