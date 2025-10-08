# app/api Package

## Overview
Next.js API routes handling HTTP requests. Each route is a file exporting GET/POST handler functions.

## API Routes (19 endpoints)

### Authentication
- `POST /api/login` - User authentication
- `POST /api/logout` - End session
- `POST /api/register` - Create account
- `GET /api/session` - Check auth status

### Game State
- `GET /api/world` - World data (all space objects)
- `GET /api/user-stats` - Iron amount and generation rate
- `GET /api/ship-stats` - Defense values

### Game Actions
- `POST /api/navigate` - Update ship direction/speed
- `POST /api/navigate-typed` - Same with typed locks
- `POST /api/collect` - Collect object
- `POST /api/collect-typed` - Same with typed locks

### Research
- `GET /api/techtree` - Tech tree state
- `POST /api/trigger-research` - Start research

### Factory
- `GET /api/tech-catalog` - Available weapons/defenses
- `GET /api/build-status` - Build queue and tech counts
- `POST /api/build-item` - Add to build queue
- `POST /api/complete-build` - Complete build (cheat)

### Other
- `GET/POST /api/messages` - User messages
- `GET /api/admin/database` - Admin DB info

## Patterns

**Auth Check:**
```typescript
const auth = await getServerAuthState(request);
if (!auth.isLoggedIn) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
```

**Typed Locks:**
```typescript
return withLocks(['GameLock', 'UserLock'], async () => {
  // Protected code
});
```

**Note:** Routes with `-typed` suffix use new typed lock system
