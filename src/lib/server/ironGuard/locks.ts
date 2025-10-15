/**
 * Lock Level Definitions for Spacewars3
 * 
 * Lock levels (with 10-unit spacing to allow future insertions):
 * - 10: Cache management operations (lowest level)
 * - 20: World operations (can skip cache if not needed)
 * - 30: User operations (can skip world if not needed)
 * - 34: Message read operations (nested within user operations)
 * - 35: Message write operations (between read and database)
 * - 40: Database operations (highest level)
 */

// Lock level constants
export const LOCK_CACHE = 10 as const;
export const LOCK_WORLD = 20 as const;
export const LOCK_USER = 30 as const;
export const LOCK_MESSAGE_READ = 34 as const;
export const LOCK_MESSAGE_WRITE = 35 as const;
export const LOCK_DATABASE = 40 as const;

// Type aliases for lock levels
export type CacheLevel = 10;
export type WorldLevel = 20;
export type UserLevel = 30;
export type MessageReadLevel = 34;
export type MessageWriteLevel = 35;
export type DatabaseLevel = 40;
