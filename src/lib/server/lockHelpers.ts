/**
 * Lock Acquisition Helpers for IronGuard V2
 * 
 * Provides convenient async wrappers for lock acquisition using try/finally pattern.
 * Each helper ensures proper lock release even if the operation throws an error.
 * 
 * Usage:
 * ```typescript
 * const result = await withWorldLock(context, async (ctx) => {
 *   // ctx now has LOCK_WORLD acquired
 *   return someOperation();
 * });
 * ```
 */

import { 
  LockContext, 
  LOCK_WORLD, 
  LOCK_USER, 
  LOCK_MESSAGE_READ, 
  LOCK_MESSAGE_WRITE, 
  LOCK_BATTLE, 
  LOCK_DATABASE,
  type LockLevel
} from './ironGuardV2.js';
import type {
  ValidWorldLockContext,
  ValidUserLockContext,
  ValidMessageReadLockContext,
  ValidMessageWriteLockContext,
  ValidBattleLockContext,
  ValidDatabaseLockContext
} from './ironGuardTypesV2.js';

/**
 * Acquire LOCK_WORLD, execute operation, and release lock.
 * Ensures lock is released even if operation throws.
 */
export async function withWorldLock<T, THeld extends readonly LockLevel[]>(
  context: ValidWorldLockContext<THeld>,
  operation: (ctx: LockContext<readonly [...THeld, 20]>) => Promise<T>
): Promise<T> {
  // Type assertion safe because ValidWorldLockContext ensures context is LockContext
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lockContext = context as any as LockContext<THeld>;
  const newContext = lockContext.acquire(LOCK_WORLD);
  if (typeof newContext === 'string') {
    throw new Error(`Failed to acquire LOCK_WORLD: ${newContext}`);
  }
  
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return await operation(newContext as any);
  } finally {
    newContext.release(LOCK_WORLD);
  }
}

/**
 * Acquire LOCK_USER, execute operation, and release lock.
 * Ensures lock is released even if operation throws.
 */
export async function withUserLock<T, THeld extends readonly LockLevel[]>(
  context: ValidUserLockContext<THeld>,
  operation: (ctx: LockContext<readonly [...THeld, 30]>) => Promise<T>
): Promise<T> {
  // Type assertion safe because ValidUserLockContext ensures context is LockContext
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lockContext = context as any as LockContext<THeld>;
  const newContext = lockContext.acquire(LOCK_USER);
  if (typeof newContext === 'string') {
    throw new Error(`Failed to acquire LOCK_USER: ${newContext}`);
  }
  
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return await operation(newContext as any);
  } finally {
    newContext.release(LOCK_USER);
  }
}

/**
 * Acquire LOCK_MESSAGE_READ, execute operation, and release lock.
 * Ensures lock is released even if operation throws.
 */
export async function withMessageReadLock<T, THeld extends readonly LockLevel[]>(
  context: ValidMessageReadLockContext<THeld>,
  operation: (ctx: LockContext<readonly [...THeld, 40]>) => Promise<T>
): Promise<T> {
  // Type assertion safe because ValidMessageReadLockContext ensures context is LockContext
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lockContext = context as any as LockContext<THeld>;
  const newContext = lockContext.acquire(LOCK_MESSAGE_READ);
  if (typeof newContext === 'string') {
    throw new Error(`Failed to acquire LOCK_MESSAGE_READ: ${newContext}`);
  }
  
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return await operation(newContext as any);
  } finally {
    newContext.release(LOCK_MESSAGE_READ);
  }
}

/**
 * Acquire LOCK_MESSAGE_WRITE, execute operation, and release lock.
 * Ensures lock is released even if operation throws.
 */
export async function withMessageWriteLock<T, THeld extends readonly LockLevel[]>(
  context: ValidMessageWriteLockContext<THeld>,
  operation: (ctx: LockContext<readonly [...THeld, 41]>) => Promise<T>
): Promise<T> {
  // Type assertion safe because ValidMessageWriteLockContext ensures context is LockContext
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lockContext = context as any as LockContext<THeld>;
  const newContext = lockContext.acquire(LOCK_MESSAGE_WRITE);
  if (typeof newContext === 'string') {
    throw new Error(`Failed to acquire LOCK_MESSAGE_WRITE: ${newContext}`);
  }
  
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return await operation(newContext as any);
  } finally {
    newContext.release(LOCK_MESSAGE_WRITE);
  }
}

/**
 * Acquire LOCK_BATTLE, execute operation, and release lock.
 * Ensures lock is released even if operation throws.
 */
export async function withBattleLock<T, THeld extends readonly LockLevel[]>(
  context: ValidBattleLockContext<THeld>,
  operation: (ctx: LockContext<readonly [...THeld, 50]>) => Promise<T>
): Promise<T> {
  // Type assertion safe because ValidBattleLockContext ensures context is LockContext
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lockContext = context as any as LockContext<THeld>;
  const newContext = lockContext.acquire(LOCK_BATTLE);
  if (typeof newContext === 'string') {
    throw new Error(`Failed to acquire LOCK_BATTLE: ${newContext}`);
  }
  
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return await operation(newContext as any);
  } finally {
    newContext.release(LOCK_BATTLE);
  }
}

/**
 * Acquire LOCK_DATABASE, execute operation, and release lock.
 * Ensures lock is released even if operation throws.
 */
export async function withDatabaseLock<T, THeld extends readonly LockLevel[]>(
  context: ValidDatabaseLockContext<THeld>,
  operation: (ctx: LockContext<readonly [...THeld, 60]>) => Promise<T>
): Promise<T> {
  // Type assertion safe because ValidDatabaseLockContext ensures context is LockContext
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lockContext = context as any as LockContext<THeld>;
  const newContext = lockContext.acquire(LOCK_DATABASE);
  if (typeof newContext === 'string') {
    throw new Error(`Failed to acquire LOCK_DATABASE: ${newContext}`);
  }
  
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return await operation(newContext as any);
  } finally {
    newContext.release(LOCK_DATABASE);
  }
}
