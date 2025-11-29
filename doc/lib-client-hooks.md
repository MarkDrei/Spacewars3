# lib/client/hooks Package

## Overview
Custom React hooks for state management, API integration, and real-time data sync.

## Hooks (8 hooks)

**Authentication:**
- **useAuth** - Auth state (isLoggedIn, username, shipId), login/logout/register functions

**Resources:**
- **useIron** - Iron amount with client-side generation calculation, polls every 5s, updates display every 100ms
- **useDefenseValues** - Hull/armor/shields with client-side regeneration

**Research:**
- **useResearchStatus** - Active research, progress, estimated completion time

**Factory:**
- **useBuildQueue** - Build queue state, buildItem function
- **useTechCounts** - Tech counts and catalog (weapons, defenses)
- **useFactoryDataCache** - Shared factory data cache (minimizes API calls)

**Game:**
- **useWorldData** - World state polling for game canvas

## Pattern

Hooks use polling with client-side calculations:
1. Poll server at intervals
2. Calculate intermediate values client-side
3. Display smooth real-time updates
4. Re-sync on next poll

**Example (useIron):**
- Server poll: every 5s → get `iron`, `ironPerSecond`
- Client calc: `displayIron = serverIron + (ironPerSecond * elapsed)`
- Display update: every 100ms
