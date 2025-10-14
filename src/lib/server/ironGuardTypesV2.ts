/**
 * IronGuard Advanced Type Definitions (Spacewars Edition)
 * 
 * This file contains sophisticated type aliases that define valid lock combinations
 * for functions with specific lock requirements. These types enable:
 * 
 * - Functions that can work with multiple lock scenarios (flexible functions)
 * - Clean, readable function signatures using descriptive type aliases
 * - Compile-time validation of complex lock state requirements
 * - Reusable constraint patterns for different lock combinations
 * 
 * The general pattern is: ValidLockXContext<THeld> where X is the required lock.
 * These types check if the held locks can either:
 * 1. Use an existing lock X (if already held)
 * 2. Acquire lock X (if ordering rules allow it)
 * 3. Reject invalid combinations with descriptive error messages
 * 
 * Lock Hierarchy:
 * - LOCK_CACHE = 10
 * - LOCK_WORLD = 20
 * - LOCK_USER = 30
 * - LOCK_MESSAGE_READ = 40
 * - LOCK_MESSAGE_WRITE = 41
 * - LOCK_BATTLE = 50
 * - LOCK_DATABASE = 60
 */

import type { LockContext, Contains, LockLevel } from './ironGuardV2';

/**
 * Type alias for contexts that can work with Cache lock (level 10)
 * Since this is the lowest level, only empty context or context with lock 10 can work with it
 */
export type ValidCacheLockContext<THeld extends readonly LockLevel[]> = 
  THeld extends readonly []
    ? LockContext<THeld>  // Empty - can acquire
    : Contains<THeld, 10> extends true
      ? LockContext<THeld>  // Already have it
      : 'Cannot work with LOCK_CACHE (10) when holding higher locks';

/**
 * Type alias for contexts that can work with World lock (level 20)
 * Accepts:
 * - Empty context
 * - Context with lock 10
 * - Context already holding lock 20
 * Rejects: Contexts with locks > 20
 */
export type ValidWorldLockContext<THeld extends readonly LockLevel[]> = 
  THeld extends readonly []
    ? LockContext<THeld>  // Empty - can acquire
    : Contains<THeld, 20> extends true
      ? LockContext<THeld>  // Already have it
      : Contains<THeld, 10> extends true
        ? LockContext<THeld>  // Have 10, can acquire 20
        : 'Cannot work with LOCK_WORLD (20) when holding higher locks';

/**
 * Type alias for contexts that can work with User lock (level 30)
 * Accepts:
 * - Empty context
 * - Context with locks 10, 20
 * - Context already holding lock 30
 * Rejects: Contexts with locks > 30
 */
export type ValidUserLockContext<THeld extends readonly LockLevel[]> = 
  THeld extends readonly []
    ? LockContext<THeld>  // Empty - can acquire
    : Contains<THeld, 30> extends true
      ? LockContext<THeld>  // Already have it
      : THeld extends readonly (infer L extends LockLevel)[]
        ? L extends 10 | 20
          ? LockContext<THeld>  // Only have 10/20, can acquire 30
          : 'Cannot work with LOCK_USER (30) when holding locks >= 40'
        : LockContext<THeld>;

/**
 * Type alias for contexts that can work with Message Read lock (level 40)
 * Accepts:
 * - Empty context
 * - Context with locks 10, 20, 30
 * - Context already holding lock 40
 * Rejects: Contexts with locks > 40
 */
export type ValidMessageReadLockContext<THeld extends readonly LockLevel[]> = 
  THeld extends readonly []
    ? LockContext<THeld>  // Empty - can acquire
    : Contains<THeld, 40> extends true
      ? LockContext<THeld>  // Already have it
      : THeld extends readonly (infer L extends LockLevel)[]
        ? L extends 10 | 20 | 30
          ? LockContext<THeld>  // Only have 10/20/30, can acquire 40
          : 'Cannot work with LOCK_MESSAGE_READ (40) when holding locks >= 41'
        : LockContext<THeld>;

/**
 * Type alias for contexts that can work with Message Write lock (level 41)
 * Accepts:
 * - Empty context
 * - Context with locks 10, 20, 30, 40
 * - Context already holding lock 41
 * Rejects: Contexts with locks > 41
 */
export type ValidMessageWriteLockContext<THeld extends readonly LockLevel[]> = 
  THeld extends readonly []
    ? LockContext<THeld>  // Empty - can acquire
    : Contains<THeld, 41> extends true
      ? LockContext<THeld>  // Already have it
      : THeld extends readonly (infer L extends LockLevel)[]
        ? L extends 10 | 20 | 30 | 40
          ? LockContext<THeld>  // Only have 10/20/30/40, can acquire 41
          : 'Cannot work with LOCK_MESSAGE_WRITE (41) when holding locks >= 50'
        : LockContext<THeld>;

/**
 * Type alias for contexts that can work with Battle lock (level 50)
 * Accepts:
 * - Empty context
 * - Context with locks 10, 20, 30, 40, 41
 * - Context already holding lock 50
 * Rejects: Contexts with locks > 50
 */
export type ValidBattleLockContext<THeld extends readonly LockLevel[]> = 
  THeld extends readonly []
    ? LockContext<THeld>  // Empty - can acquire
    : Contains<THeld, 50> extends true
      ? LockContext<THeld>  // Already have it
      : THeld extends readonly (infer L extends LockLevel)[]
        ? L extends 10 | 20 | 30 | 40 | 41
          ? LockContext<THeld>  // Only have 10/20/30/40/41, can acquire 50
          : 'Cannot work with LOCK_BATTLE (50) when holding locks >= 60'
        : LockContext<THeld>;

/**
 * Type alias for contexts that can work with Database lock (level 60)
 * Accepts:
 * - Empty context
 * - Context with locks 10, 20, 30, 40, 41, 50
 * - Context already holding lock 60
 * Rejects: Never (60 is the highest lock)
 */
export type ValidDatabaseLockContext<THeld extends readonly LockLevel[]> = 
  THeld extends readonly []
    ? LockContext<THeld>  // Empty - can acquire
    : Contains<THeld, 60> extends true
      ? LockContext<THeld>  // Already have it
      : THeld extends readonly (infer L extends LockLevel)[]
        ? L extends 10 | 20 | 30 | 40 | 41 | 50
          ? LockContext<THeld>  // Only have lower locks, can acquire 60
          : never  // Shouldn't reach here (60 is highest)
        : LockContext<THeld>;
