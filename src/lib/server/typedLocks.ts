// ---
// IronGuard Lock System Integration
// uses @markdrei/ironguard-typescript-locks
// ---

import { 
  LOCK_2,
  LOCK_4,
  LOCK_6,
  LOCK_8,
  LOCK_10,
  LOCK_11,
  LOCK_12,
  LOCK_13,
} from '@markdrei/ironguard-typescript-locks';

// Re-export IronGuard core functions and types with original names
export { 
  createLockContext,
  type LockLevel,
  type LockMode
} from '@markdrei/ironguard-typescript-locks';

// Re-export IronGuard lock constants and context types
export {
  LOCK_2,
  LOCK_4,
  LOCK_5,
  LOCK_6,
  LOCK_8,
  LOCK_10,
  LOCK_11,
  LOCK_12,
  LOCK_13,
  type LocksAtMost2,
  type LocksAtMost3,
  type LocksAtMost4,
  type LocksAtMost5,
  type LocksAtMost6,
  type LocksAtMost8,
  type LocksAtMost9,
  type LocksAtMostAndHas4,
  type LocksAtMostAndHas6,
  type HasLock4Context,
  type HasLock6Context,
  type HasLock10Context,
  type HasLock11Context,
  type HasLock12Context,
  type HasLock13Context,
  type LockContext,
  type IronLocks,
  type NullableLocksAtMost10,
  type NullableLocksAtMost11
} from '@markdrei/ironguard-typescript-locks';

// Overview of the used lock levels and why we have them like that
//  Battle influences users (all the time) and world state (teleportation)
//  User data is often independent of the world state, but sometimes needs to access ship information
// Messages are independent
// Database operation are for background syncing only.
export const BATTLE_LOCK = LOCK_2;  // Battle state operations
export const USER_LOCK = LOCK_4;
export const WORLD_LOCK = LOCK_6;
export const MESSAGE_LOCK = LOCK_8;
export const DATABASE_LOCK_USERS = LOCK_10;
export const DATABASE_LOCK_SPACE_OBJECTS = LOCK_11;
export const DATABASE_LOCK_MESSAGES = LOCK_12;
export const DATABASE_LOCK_BATTLES = LOCK_13;


