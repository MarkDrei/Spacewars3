/**
 * IronGuard Type Definitions
 * 
 * Lock levels for the Spacewars application
 */

export type LockLevel = 10 | 20 | 30 | 34 | 35 | 40;

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
