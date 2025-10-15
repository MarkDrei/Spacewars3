/**
 * IronGuard Lock System - Public API
 * 
 * This module provides compile-time lock ordering validation for the application.
 */

export { LockContext, createLockContext, createEmptyContext } from './core';
export type { Contains, CanAcquire } from './core';

export {
  LOCK_CACHE,
  LOCK_WORLD,
  LOCK_USER,
  LOCK_MESSAGE_READ,
  LOCK_MESSAGE_WRITE,
  LOCK_DATABASE,
} from './types';

export type {
  LockLevel,
  CacheLevel,
  WorldLevel,
  UserLevel,
  MessageReadLevel,
  MessageWriteLevel,
  DatabaseLevel,
} from './types';

export { AsyncMutex, AsyncReadWriteLock } from './adapter';
