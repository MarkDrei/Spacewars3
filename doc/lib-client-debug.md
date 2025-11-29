# lib/client/debug Package

## Overview
Debug state management singleton.

## File
**debugState.ts** - Singleton DebugState class
- `debugDrawingsEnabled` getter - Read debug state
- `setDebugDrawingsEnabled(enabled)` - Toggle debug rendering

## Usage
```typescript
import { debugState } from '@/lib/client/debug/debugState';

if (debugState.debugDrawingsEnabled) {
  // Render debug info
}
```

Used by renderers to show/hide debug visualizations (collision boxes, trajectories).
