# lib/client/services Package

## Overview
API service layer abstracting HTTP communication with backend. Type-safe interfaces with error handling.

## Services (11 files)

**Authentication:**
- **authService** - login, logout, register, checkSession

**Game:**
- **navigationService** - setShipDirection, interceptTarget
- **collectionService** - collectObject
- **worldDataService** - getWorldData

**Stats:**
- **userStatsService** - getUserStats (iron, ironPerSecond)
- **shipStatsService** - getShipStats (defense values)

**Systems:**
- **researchService** - getTechTree, triggerResearch
- **factoryService** - getTechCatalog, getBuildStatus, buildItem, completeBuild

**Other:**
- **messagesService** - getMessages, sendMessage
- **eventService** - Global event bus (PubSub pattern)

**Barrel:**
- **index.ts** - Package exports

## Patterns

**Service Function:**
```typescript
export const service = {
  async operation(params) {
    const response = await fetch('/api/endpoint', {
      method: 'POST',
      credentials: 'include',
      body: JSON.stringify(params)
    });
    return response.json();
  }
};
```

**Event Bus:**
```typescript
globalEvents.emit('IRON_CHANGED', { iron: 1000 });
globalEvents.on('RESEARCH_COMPLETED', handleResearch);
```
