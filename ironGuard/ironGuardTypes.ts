/**
 * IronGuard Advanced Type Definitions
 * 
 * This file contains sophisticated type aliases that define valid lock combinations
 * for functions with specific lock requirements. These types enable:
 * 
 * - Functions that can work with multiple lock scenarios (flexible functions)
 * - Clean, readable function signatures using descriptive type aliases
 * - Compile-time validation of complex lock state requirements
 * - Reusable constraint patterns for different lock combinations
 * 
 * The general pattern is: ValidLockXContext<THeld> where X is the required lock level.
 * These types check if the held locks can either:
 * 1. Use an existing lock X (if already held)
 * 2. Acquire lock X (if ordering rules allow it)
 * 3. Reject invalid combinations with descriptive error messages
 */

import type { LockContext, Contains } from './ironGuardSystem';

type LockLevel = 1 | 2 | 3 | 4 | 5;

/**
 * Type alias for lock contexts that can work with lock 3.
 * Accepts contexts that either:
 * - Can acquire lock 3 (empty, has 1, has 2, has 1&2)
 * - Already have lock 3 (can use existing)
 * - Rejects contexts with only higher locks (4, 5) without lock 3
 */
type ValidLock3Context<THeld extends readonly LockLevel[]> = 
  THeld extends readonly []
    ? LockContext<THeld>  // Empty - can acquire lock 3
    : Contains<THeld, 1> extends true
      ? Contains<THeld, 2> extends true
        ? LockContext<THeld>  // Has 1,2 - can acquire lock 3
        : LockContext<THeld>  // Has 1 - can acquire lock 3
      : Contains<THeld, 2> extends true
        ? LockContext<THeld>  // Has 2 - can acquire lock 3
        : Contains<THeld, 3> extends true
          ? LockContext<THeld>  // Has 3+ - can use lock 3
          : THeld extends readonly [4, ...any[]]
            ? 'Cannot work with lock 4+ without lock 3'
            : THeld extends readonly [5, ...any[]]
              ? 'Cannot work with lock 5+ without lock 3'
              : LockContext<THeld>;

// Future lock constraint types can be added here following the same pattern:
// type ValidLock2Context<THeld extends readonly LockLevel[]> = ...
// type ValidLock4Context<THeld extends readonly LockLevel[]> = ...

export type {
  LockLevel,
  ValidLock3Context
};