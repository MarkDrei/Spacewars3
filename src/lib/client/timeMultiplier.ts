/**
 * Client-side module for storing and retrieving the current time multiplier.
 * 
 * This module provides a simple module-level store for the time multiplier value
 * that is synchronized from the server via the useIron hook's polling mechanism.
 * Other hooks (useDefenseValues, useWorldData) can import and read this value
 * for their interpolation calculations without needing React Context.
 * 
 * Pattern: Module-level state for rarely-changing server values (acceptable staleness).
 */

let currentMultiplier = 1;

/**
 * Get the current time multiplier value.
 * @returns The current time multiplier (>= 1)
 */
export function getTimeMultiplier(): number {
  return currentMultiplier;
}

/**
 * Set the current time multiplier value.
 * Called by useIron hook when it receives updated stats from the server.
 * @param value - The new time multiplier value (should be >= 1)
 */
export function setTimeMultiplier(value: number): void {
  currentMultiplier = value;
}

/**
 * Reset the time multiplier to default value (for testing).
 * @internal
 */
export function resetTimeMultiplier(): void {
  currentMultiplier = 1;
}
