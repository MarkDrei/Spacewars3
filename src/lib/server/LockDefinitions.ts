// ---
// LockDefinitions - Central lock level definitions for IronGuard
// ---

import { LOCK_2, LOCK_4, LOCK_8 } from '@markdrei/ironguard-typescript-locks';

// Message Cache Locks
export const MESSAGE_CACHE_LOCK = LOCK_2; // For cache management operations
export const MESSAGE_DATA_LOCK = LOCK_4;  // For message data operations
export const MESSAGE_DB_LOCK = LOCK_8;  // For database operations
