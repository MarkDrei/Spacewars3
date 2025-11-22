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


