/**
 * IronGuard Advanced Type Definitions for Spacewars
 * 
 * This file contains sophisticated type aliases that define valid lock combinations
 * for functions with specific lock requirements. These types enable:
 * 
 * - Functions that can work with multiple lock scenarios (flexible functions)
 * - Clean, readable function signatures using descriptive type aliases
 * - Compile-time validation of complex lock state requirements
 * - Reusable constraint patterns for different lock combinations
 * 
 * ## Usage Pattern
 * 
 * ### For Functions That Need a Specific Lock
 * 
 * ```typescript
 * // Function that needs user lock (level 2)
 * async function needsUserLock<CurrentLevel extends number>(
 *   userId: number,
 *   context: ValidUserLockContext<CurrentLevel>  // ✅ Compile-time validated
 * ): Promise<void> {
 *   await cacheManager.withUserLock(context, async (userCtx) => {
 *     // ... work with user lock
 *   });
 * }
 * 
 * // Valid calls:
 * needsUserLock(123, emptyCtx);                    // ✅ Can acquire
 * needsUserLock(123, worldCtx);                    // ✅ Can acquire from lower level
 * 
 * // Invalid calls (compile errors):
 * needsUserLock(123, databaseCtx);                 // ❌ Cannot acquire from higher level
 * ```
 * 
 * ### For Functions With Flexible Lock Requirements
 * 
 * ```typescript
 * // Function that can use OR acquire message lock
 * async function flexibleMessageAccess<CurrentLevel extends number>(
 *   userId: number,
 *   context: ValidMessageLockContext<CurrentLevel>
 * ): Promise<void> {
 *   // Type system ensures we can either:
 *   // 1. Use existing message lock if already held
 *   // 2. Acquire message lock if ordering allows
 *   await cacheManager.withMessageRead(context, async (msgCtx) => {
 *     // ... work with message lock
 *   });
 * }
 * ```
 * 
 * ## Lock Hierarchy (Spacewars)
 * 
 * ```
 * Level 0:   Cache Management
 * Level 1:   World (Read: 1, Write: 1)
 * Level 2:   User
 * Level 2.4: Message Read
 * Level 2.5: Message Write
 * Level 2.8: Battle
 * Level 3:   Database (Read: 3, Write: 3)
 * ```
 * 
 * ## Type Constraint Pattern
 * 
 * Each ValidXLockContext type checks if the current lock state allows:
 * 1. Using an existing lock X (if already held)
 * 2. Acquiring lock X (if ordering rules permit)
 * 3. Rejecting invalid combinations with descriptive error messages
 */

import type { LockContext, CanAcquire, Unlocked } from './ironGuardSystem';
import type {
  CacheLevel,
  WorldLevel,
  UserLevel,
  MessageReadLevel,
  MessageWriteLevel,
  BattleLevel,
  DatabaseLevel
} from './ironGuardSystem';

/**
 * Type alias for contexts that can work with World lock (level 1)
 * Accepts: empty context, or any context at level 0
 * Rejects: contexts at level 1 or higher
 * 
 * Note: State parameter is preserved to maintain lock state tracking
 */
export type ValidWorldLockContext<State, CurrentLevel extends number> = 
  CanAcquire<WorldLevel, CurrentLevel> extends true
    ? LockContext<State, CurrentLevel>
    : `Cannot acquire world lock (level ${WorldLevel}) when holding level ${CurrentLevel}`;

/**
 * Type alias for contexts that can work with User lock (level 2)
 * Accepts: empty context, or contexts at level 0-1
 * Rejects: contexts at level 2 or higher
 * 
 * Note: State parameter is preserved to maintain lock state tracking
 */
export type ValidUserLockContext<State, CurrentLevel extends number> = 
  CanAcquire<UserLevel, CurrentLevel> extends true
    ? LockContext<State, CurrentLevel>
    : `Cannot acquire user lock (level ${UserLevel}) when holding level ${CurrentLevel}`;

/**
 * Type alias for contexts that can work with Message Read lock (level 2.4)
 * Accepts: empty context, or contexts at level 0-2
 * Rejects: contexts at level 2.4 or higher
 * 
 * Note: State parameter is preserved to maintain lock state tracking
 */
export type ValidMessageReadLockContext<State, CurrentLevel extends number> = 
  CanAcquire<MessageReadLevel, CurrentLevel> extends true
    ? LockContext<State, CurrentLevel>
    : `Cannot acquire message read lock (level ${MessageReadLevel}) when holding level ${CurrentLevel}`;

/**
 * Type alias for contexts that can work with Message Write lock (level 2.5)
 * Accepts: empty context, or contexts at level 0-2.4
 * Rejects: contexts at level 2.5 or higher
 * 
 * Note: State parameter is preserved to maintain lock state tracking
 */
export type ValidMessageWriteLockContext<State, CurrentLevel extends number> = 
  CanAcquire<MessageWriteLevel, CurrentLevel> extends true
    ? LockContext<State, CurrentLevel>
    : `Cannot acquire message write lock (level ${MessageWriteLevel}) when holding level ${CurrentLevel}`;

/**
 * Type alias for contexts that can work with Battle lock (level 2.8)
 * Accepts: empty context, or contexts at level 0-2.5
 * Rejects: contexts at level 2.8 or higher
 * 
 * Note: State parameter is preserved to maintain lock state tracking
 */
export type ValidBattleLockContext<State, CurrentLevel extends number> = 
  CanAcquire<BattleLevel, CurrentLevel> extends true
    ? LockContext<State, CurrentLevel>
    : `Cannot acquire battle lock (level ${BattleLevel}) when holding level ${CurrentLevel}`;

/**
 * Type alias for contexts that can work with Database lock (level 3)
 * Accepts: empty context, or contexts at level 0-2.8
 * Rejects: contexts at level 3 or higher (already holding database lock)
 * 
 * Note: State parameter is preserved to maintain lock state tracking
 */
export type ValidDatabaseLockContext<State, CurrentLevel extends number> = 
  CanAcquire<DatabaseLevel, CurrentLevel> extends true
    ? LockContext<State, CurrentLevel>
    : `Cannot acquire database lock (level ${DatabaseLevel}) when holding level ${CurrentLevel}`;

/**
 * Helper type for functions that need ANY valid context (no specific lock required)
 * This is for functions that thread contexts through without acquiring new locks
 * 
 * Note: Both State and MaxLevel are generic to preserve full type information
 */
export type AnyValidContext<State = unknown, MaxLevel extends number = number> = 
  LockContext<State, MaxLevel>;

/**
 * Helper type for entry-point functions that create empty contexts
 * Use this to clearly mark functions that are lock entry points
 * 
 * Note: Unlocked state with never level means no locks held yet
 */
export type EmptyContextType = LockContext<Unlocked, never>;
