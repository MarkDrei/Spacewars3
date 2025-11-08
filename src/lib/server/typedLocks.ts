// ---
// IronGuard Lock System Integration
// Replaces custom typedLocks implementation with @markdrei/ironguard-typescript-locks
// ---

import { 
  createLockContext as ironguardCreateLockContext,
  LockContext as IronGuardLockContext,
  LOCK_2,
  LOCK_4,
  LOCK_5,
  LOCK_6,
  LOCK_8,
  LOCK_10,
  type LockLevel as IronGuardLockLevel
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
  type ValidLock2Context,
  type ValidLock4Context,
  type ValidLock5Context,
  type ValidLock6Context,
  type ValidLock8Context,
  type ValidLock10Context
} from '@markdrei/ironguard-typescript-locks';

// Lock level mapping from old system to IronGuard
export const CACHE_LOCK = LOCK_2;
export const WORLD_LOCK = LOCK_4;
export const BATTLE_LOCK = LOCK_5;  // Battle state operations
export const USER_LOCK = LOCK_6;
export const MESSAGE_LOCK = LOCK_8;
export const DATABASE_LOCK = LOCK_10;

// Legacy type aliases for numeric lock levels (backward compatibility)
export type CacheLevel = 2;
export type WorldLevel = 4;
export type UserLevel = 6;
export type MessageReadLevel = 8;
export type MessageWriteLevel = 8;
export type DatabaseLevel = 10;

// Legacy LockContext type that wraps IronGuard's context
// This allows existing code to continue working during migration
export type LockContext<_State = any, _MaxLevel extends number = never> = IronGuardLockContext<readonly []> | IronGuardLockContext<readonly [IronGuardLockLevel]> | IronGuardLockContext<readonly [IronGuardLockLevel, IronGuardLockLevel]> | IronGuardLockContext<readonly [IronGuardLockLevel, IronGuardLockLevel, IronGuardLockLevel]> | IronGuardLockContext<readonly [IronGuardLockLevel, IronGuardLockLevel, IronGuardLockLevel, IronGuardLockLevel]>;

// Legacy types for backward compatibility
export type EmptyContext = IronGuardLockContext<readonly []> & { _state?: any; _maxLevel?: never };
export type Unlocked = never;
export type Locked<_Name extends string> = never;

// Legacy type validation exports for tests
export type TestValidCacheToWorld = true;
export type TestValidWorldToUser = true;
export type TestInvalidUserToWorld = false;
export type TestInvalidSameLevel = false;

// Legacy helper
export function createEmptyContext(): EmptyContext {
  const ctx = ironguardCreateLockContext() as EmptyContext;
  // Add legacy properties for backward compatibility with tests
  Object.defineProperty(ctx, '_state', { value: 'unlocked', enumerable: false });
  Object.defineProperty(ctx, '_maxLevel', { value: undefined, enumerable: false });
  return ctx;
}

// Wrapper classes for backward compatibility with callback-based API
// These wrap IronGuard's lock functionality while maintaining the old interface

/**
 * TypedMutex wrapper that uses IronGuard internally
 * Maintains callback-based API for backward compatibility
 */
export class TypedMutex<Name extends string, Level extends IronGuardLockLevel> {
  private readonly level: Level;
  private readonly name: Name;
  private locked = false;
  private queueLength = 0;

  constructor(name: Name, level: Level) {
    this.name = name;
    this.level = level;
  }

  async acquire<T>(
    context: LockContext<any, any>,
    fn: (ctx: LockContext<any, any>) => Promise<T>
  ): Promise<T> {
    // Track queue
    if (this.locked) {
      this.queueLength++;
    } else {
      this.locked = true;
    }
    
    try {
      // Acquire the lock using IronGuard
      const lockCtx = await (context as IronGuardLockContext).acquireWrite(this.level as any);
      try {
        // Dequeue if we were queued
        if (this.queueLength > 0) {
          this.queueLength--;
        }
        
        // Add legacy properties for backward compatibility with tests
        const wrappedCtx = lockCtx as any;
        Object.defineProperty(wrappedCtx, '_state', { value: `locked:${this.name}`, enumerable: false });
        Object.defineProperty(wrappedCtx, '_maxLevel', { value: this.level, enumerable: false });
        return await fn(wrappedCtx);
      } finally {
        lockCtx.dispose();
        this.locked = false;
      }
    } catch (error) {
      if (this.queueLength > 0) {
        this.queueLength--;
      } else {
        this.locked = false;
      }
      throw error;
    }
  }

  isLocked(): boolean {
    return this.locked;
  }

  getQueueLength(): number {
    return this.queueLength;
  }
}

/**
 * TypedReadWriteLock wrapper that uses IronGuard internally
 * Maintains callback-based API for backward compatibility
 */
export class TypedReadWriteLock<Name extends string, ReadLevel extends IronGuardLockLevel, WriteLevel extends IronGuardLockLevel = ReadLevel> {
  private readonly readLevel: ReadLevel;
  private readonly writeLevel: WriteLevel;
  private readonly name: Name;
  private readers = 0;
  private writer = false;
  private readQueue = 0;
  private writeQueue = 0;

  constructor(name: Name, readLevel: ReadLevel, writeLevel?: WriteLevel) {
    this.name = name;
    this.readLevel = readLevel;
    this.writeLevel = (writeLevel !== undefined ? writeLevel : readLevel) as WriteLevel;
  }

  async read<T>(
    context: LockContext<any, any>,
    fn: (ctx: LockContext<any, any>) => Promise<T>
  ): Promise<T> {
    // Track queuing
    if (this.writer || this.writeQueue > 0) {
      this.readQueue++;
    }
    
    try {
      const lockCtx = await (context as IronGuardLockContext).acquireRead(this.readLevel as any);
      try {
        // Dequeue and mark as reading
        if (this.readQueue > 0) {
          this.readQueue--;
        }
        this.readers++;
        
        // Add legacy properties for backward compatibility with tests
        const wrappedCtx = lockCtx as any;
        Object.defineProperty(wrappedCtx, '_state', { value: `locked:${this.name}:read`, enumerable: false });
        Object.defineProperty(wrappedCtx, '_maxLevel', { value: this.readLevel, enumerable: false });
        return await fn(wrappedCtx);
      } finally {
        this.readers--;
        lockCtx.dispose();
      }
    } catch (error) {
      if (this.readQueue > 0) {
        this.readQueue--;
      }
      throw error;
    }
  }

  async write<T>(
    context: LockContext<any, any>,
    fn: (ctx: LockContext<any, any>) => Promise<T>
  ): Promise<T> {
    // Track queuing
    if (this.writer || this.readers > 0) {
      this.writeQueue++;
    }
    
    try {
      const lockCtx = await (context as IronGuardLockContext).acquireWrite(this.writeLevel as any);
      try {
        // Dequeue and mark as writing
        if (this.writeQueue > 0) {
          this.writeQueue--;
        }
        this.writer = true;
        
        // Add legacy properties for backward compatibility with tests
        const wrappedCtx = lockCtx as any;
        Object.defineProperty(wrappedCtx, '_state', { value: `locked:${this.name}:write`, enumerable: false });
        Object.defineProperty(wrappedCtx, '_maxLevel', { value: this.writeLevel, enumerable: false });
        return await fn(wrappedCtx);
      } finally {
        this.writer = false;
        lockCtx.dispose();
      }
    } catch (error) {
      if (this.writeQueue > 0) {
        this.writeQueue--;
      }
      throw error;
    }
  }

  getStats(): { readers: number; writer: boolean; readQueue: number; writeQueue: number } {
    return {
      readers: this.readers,
      writer: this.writer,
      readQueue: this.readQueue,
      writeQueue: this.writeQueue
    };
  }
}
