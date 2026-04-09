/**
 * AfterburnerService — In-memory singleton for managing per-player afterburner state.
 *
 * Follows the globalThis-based singleton pattern used by TimeMultiplierService.
 * State is not persisted; it is lost on server restart (acceptable).
 *
 * Time multiplier integration:
 *   effectiveElapsedMs = (Date.now() - activatedAtMs) × timeMultiplier
 * Boost active when:  effectiveElapsedMs < durationMs
 * Cooldown active when: durationMs <= effectiveElapsedMs < durationMs + cooldownMs
 * Fully expired when: effectiveElapsedMs >= durationMs + cooldownMs
 */

import type { AfterburnerState } from './afterburnerTypes';

// Global singleton storage
declare global {
  var afterburnerServiceInstance: AfterburnerService | undefined;
}

export class AfterburnerService {
  private states: Map<number, AfterburnerState>;

  private constructor() {
    this.states = new Map();
  }

  /** Get the singleton instance. */
  static getInstance(): AfterburnerService {
    if (!globalThis.afterburnerServiceInstance) {
      globalThis.afterburnerServiceInstance = new AfterburnerService();
    }
    return globalThis.afterburnerServiceInstance;
  }

  /** Reset the singleton instance (for test isolation). */
  static resetInstance(): void {
    globalThis.afterburnerServiceInstance = undefined;
  }

  /** Store afterburner state for a user. */
  activate(
    userId: number,
    durationMs: number,
    cooldownMs: number,
    boostedSpeed: number,
  ): void {
    this.states.set(userId, {
      userId,
      activatedAtMs: Date.now(),
      durationMs,
      cooldownMs,
      boostedSpeed,
    });
  }

  /** Return the raw afterburner state for a user, or null if none exists. */
  getState(userId: number): AfterburnerState | null {
    return this.states.get(userId) ?? null;
  }

  /** Check whether the user's boost is still active. */
  isActive(userId: number, timeMultiplier: number): boolean {
    const effective = this.effectiveElapsed(userId, timeMultiplier);
    if (effective === null) return false;
    const state = this.states.get(userId)!;
    return effective < state.durationMs;
  }

  /** Check whether the user is in the cooldown window (after boost, before full expiry). */
  isOnCooldown(userId: number, timeMultiplier: number): boolean {
    const effective = this.effectiveElapsed(userId, timeMultiplier);
    if (effective === null) return false;
    const state = this.states.get(userId)!;
    return effective >= state.durationMs && effective < state.durationMs + state.cooldownMs;
  }

  /**
   * Return true if the user may activate the afterburner.
   * True when no state exists or state is fully expired.
   * If fully expired, cleans up the stale state entry.
   */
  canActivate(userId: number, timeMultiplier: number): boolean {
    const state = this.states.get(userId);
    if (!state) return true;

    const effective = this.effectiveElapsed(userId, timeMultiplier)!;
    if (effective >= state.durationMs + state.cooldownMs) {
      this.states.delete(userId);
      return true;
    }
    return false;
  }

  /** Remaining boost time in ms (0 if not active). */
  getBoostRemainingMs(userId: number, timeMultiplier: number): number {
    const effective = this.effectiveElapsed(userId, timeMultiplier);
    if (effective === null) return 0;
    const state = this.states.get(userId)!;
    if (effective >= state.durationMs) return 0;
    return state.durationMs - effective;
  }

  /** Remaining cooldown time in ms (0 if not on cooldown). */
  getCooldownRemainingMs(userId: number, timeMultiplier: number): number {
    const effective = this.effectiveElapsed(userId, timeMultiplier);
    if (effective === null) return 0;
    const state = this.states.get(userId)!;
    if (effective < state.durationMs) return 0;
    const totalMs = state.durationMs + state.cooldownMs;
    if (effective >= totalMs) return 0;
    return totalMs - effective;
  }

  /**
   * Check if the boost has expired.
   * Returns `{ expired: true }` if the boost just crossed the duration boundary.
   * Returns `null` if still active or no state exists.
   */
  checkAndExpire(userId: number, timeMultiplier: number): { expired: boolean } | null {
    const effective = this.effectiveElapsed(userId, timeMultiplier);
    if (effective === null) return null;
    const state = this.states.get(userId)!;
    if (effective >= state.durationMs) {
      return { expired: true };
    }
    return null;
  }

  /** Remove all afterburner state for a user. */
  clearState(userId: number): void {
    this.states.delete(userId);
  }

  /** Return all user IDs that currently have afterburner state stored. */
  getActiveUserIds(): number[] {
    return Array.from(this.states.keys());
  }

  // ── private helpers ──

  /** Compute effective elapsed ms, or null if no state exists for the user. */
  private effectiveElapsed(userId: number, timeMultiplier: number): number | null {
    const state = this.states.get(userId);
    if (!state) return null;
    return (Date.now() - state.activatedAtMs) * timeMultiplier;
  }
}
