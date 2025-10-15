/**
 * IronGuard Type Definitions
 * 
 * Type aliases and helpers for lock level validation and context requirements
 */

import type { LockContext, Contains } from './core';

// Lock level type - only these values are allowed
export type LockLevel = 10 | 20 | 30 | 34 | 35 | 40;

/**
 * Type alias for lock contexts that can work with a specific lock level.
 * Accepts contexts that either:
 * - Can acquire the lock (empty or have lower locks)
 * - Already have the lock (can use existing)
 * - Rejects contexts with only higher locks without the required lock
 */
export type ValidLockContext<
  TRequiredLevel extends LockLevel,
  THeld extends readonly LockLevel[]
> = 
  THeld extends readonly []
    ? LockContext<THeld>  // Empty - can acquire any lock
    : Contains<THeld, TRequiredLevel> extends true
      ? LockContext<THeld>  // Already has required lock
      : THeld extends readonly [infer First, ...any[]]
        ? First extends LockLevel
          ? First extends TRequiredLevel
            ? LockContext<THeld>  // First lock is the required one
            : TRequiredLevel extends First
              ? `Cannot work with lock ${TRequiredLevel} - already holding higher lock ${First}`
              : LockContext<THeld>  // Can acquire required lock (it's higher than held)
          : never
        : LockContext<THeld>;

// Convenience type aliases for common lock contexts
export type ValidCacheContext<THeld extends readonly LockLevel[]> = ValidLockContext<10, THeld>;
export type ValidWorldContext<THeld extends readonly LockLevel[]> = ValidLockContext<20, THeld>;
export type ValidUserContext<THeld extends readonly LockLevel[]> = ValidLockContext<30, THeld>;
export type ValidMessageReadContext<THeld extends readonly LockLevel[]> = ValidLockContext<34, THeld>;
export type ValidMessageWriteContext<THeld extends readonly LockLevel[]> = ValidLockContext<35, THeld>;
export type ValidDatabaseContext<THeld extends readonly LockLevel[]> = ValidLockContext<40, THeld>;
