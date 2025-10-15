/**
 * IronGuard Lock System - Public API
 * 
 * Export all public types, classes, and functions
 */

// Core types and functions
export { LockContext, createEmptyLockContext } from './core';
export type { Contains, CanAcquire } from './core';

// Type definitions
export type { 
  LockLevel,
  ValidLockContext,
  ValidCacheContext,
  ValidWorldContext,
  ValidUserContext,
  ValidMessageReadContext,
  ValidMessageWriteContext,
  ValidDatabaseContext
} from './types';

// Lock constants and level types
export {
  LOCK_CACHE,
  LOCK_WORLD,
  LOCK_USER,
  LOCK_MESSAGE_READ,
  LOCK_MESSAGE_WRITE,
  LOCK_DATABASE
} from './locks';

export type {
  CacheLevel,
  WorldLevel,
  UserLevel,
  MessageReadLevel,
  MessageWriteLevel,
  DatabaseLevel
} from './locks';

// Async adapters for runtime lock management
export { AsyncMutex, AsyncReadWriteLock } from './adapter';
