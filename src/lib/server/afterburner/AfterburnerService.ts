/**
 * AfterburnerService — In-memory singleton for managing per-player afterburner state.
 *
 * Follows the globalThis-based singleton pattern used by TimeMultiplierService.
 * State is not persisted; it is lost on server restart (acceptable).
 *
 * Time multiplier integration:
 *   effectiveElapsedMs = (Date.now() - updatedAtMs) × timeMultiplier
 * While active, fuel drains linearly over the configured full duration.
 * While inactive, fuel recharges linearly over the configured cooldown.
 * Activation requires at least 33% fuel.
 */

import type { AfterburnerConfig, AfterburnerState, AfterburnerStatusSnapshot } from './afterburnerTypes';

declare global {
  var afterburnerServiceInstance: AfterburnerService | undefined;
}

export class AfterburnerService {
  static readonly MIN_ACTIVATION_RATIO = 1 / 3;

  private states: Map<number, AfterburnerState>;

  private constructor() {
    this.states = new Map();
  }

  static getInstance(): AfterburnerService {
    if (!globalThis.afterburnerServiceInstance) {
      globalThis.afterburnerServiceInstance = new AfterburnerService();
    }
    return globalThis.afterburnerServiceInstance;
  }

  static resetInstance(): void {
    globalThis.afterburnerServiceInstance = undefined;
  }

  activate(userId: number, config: AfterburnerConfig): AfterburnerStatusSnapshot {
    const status = this.getStatus(userId, config);
    this.states.set(userId, {
      userId,
      updatedAtMs: Date.now(),
      fuelRatio: status.fuelRatio,
      isActive: true,
      boostedSpeed: config.boostedSpeed,
    });

    return this.getStatus(userId, config);
  }

  deactivate(userId: number, config: AfterburnerConfig): AfterburnerStatusSnapshot | null {
    const status = this.getStatus(userId, config);
    if (!status.isActive) {
      return null;
    }

    const state = this.states.get(userId);
    this.states.set(userId, {
      userId,
      updatedAtMs: Date.now(),
      fuelRatio: status.fuelRatio,
      isActive: false,
      boostedSpeed: state?.boostedSpeed ?? config.boostedSpeed,
    });

    return this.getStatus(userId, config);
  }

  getState(userId: number): AfterburnerState | null {
    return this.states.get(userId) ?? null;
  }

  getStatus(userId: number, config: AfterburnerConfig): AfterburnerStatusSnapshot {
    const state = this.states.get(userId);
    if (!state) {
      return this.buildSnapshot(
        {
          isActive: false,
          fuelRatio: 1,
          boostedSpeed: 0,
        },
        config,
      );
    }

    const projected = this.projectState(state, config);

    if (!projected.isActive && projected.fuelRatio >= 1) {
      this.states.delete(userId);
    } else if (projected.isActive !== state.isActive || Math.abs(projected.fuelRatio - state.fuelRatio) > 1e-9) {
      this.states.set(userId, {
        ...state,
        updatedAtMs: Date.now(),
        fuelRatio: projected.fuelRatio,
        isActive: projected.isActive,
      });
    }

    return this.buildSnapshot(projected, config);
  }

  isActive(userId: number, config: AfterburnerConfig): boolean {
    return this.getStatus(userId, config).isActive;
  }

  isOnCooldown(userId: number, config: AfterburnerConfig): boolean {
    const status = this.getStatus(userId, config);
    return !status.isActive && status.cooldownRemainingMs > 0;
  }

  canActivate(userId: number, config: AfterburnerConfig): boolean {
    return this.getStatus(userId, config).canActivate;
  }

  getBoostRemainingMs(userId: number, config: AfterburnerConfig): number {
    return this.getStatus(userId, config).boostRemainingMs;
  }

  getCooldownRemainingMs(userId: number, config: AfterburnerConfig): number {
    return this.getStatus(userId, config).cooldownRemainingMs;
  }

  getTimeToActivationMs(userId: number, config: AfterburnerConfig): number {
    return this.getStatus(userId, config).timeToActivationMs;
  }

  checkAndExpire(userId: number, config: AfterburnerConfig): { expired: boolean } | null {
    const wasActive = this.states.get(userId)?.isActive ?? false;
    const status = this.getStatus(userId, config);
    if (wasActive && !status.isActive) {
      return { expired: true };
    }
    return null;
  }

  clearState(userId: number): void {
    this.states.delete(userId);
  }

  getActiveUserIds(): number[] {
    return Array.from(this.states.keys());
  }

  private buildSnapshot(
    projected: { isActive: boolean; fuelRatio: number; boostedSpeed: number },
    config: AfterburnerConfig,
  ): AfterburnerStatusSnapshot {
    const fuelRatio = this.clampRatio(projected.fuelRatio);
    const thresholdRatio = AfterburnerService.MIN_ACTIVATION_RATIO;
    const fuelRemainingMs = fuelRatio * config.fuelCapacityMs;
    const canActivate = !projected.isActive && fuelRatio + 1e-9 >= thresholdRatio;
    const cooldownRemainingMs = projected.isActive ? 0 : Math.max(0, (1 - fuelRatio) * config.cooldownMs);
    const timeToActivationMs = projected.isActive || canActivate
      ? 0
      : Math.max(0, (thresholdRatio - fuelRatio) * config.cooldownMs);

    return {
      isActive: projected.isActive,
      canActivate,
      fuelRatio,
      fuelRemainingMs,
      fuelCapacityMs: config.fuelCapacityMs,
      fuelPercent: fuelRatio * 100,
      boostRemainingMs: projected.isActive ? fuelRemainingMs : 0,
      cooldownRemainingMs,
      timeToActivationMs,
      boostedSpeed: projected.isActive ? projected.boostedSpeed : 0,
    };
  }

  private projectState(
    state: AfterburnerState,
    config: AfterburnerConfig,
  ): { isActive: boolean; fuelRatio: number; boostedSpeed: number } {
    const effectiveElapsed = (Date.now() - state.updatedAtMs) * config.timeMultiplier;
    const fuelRatio = this.clampRatio(state.fuelRatio);

    if (effectiveElapsed <= 0) {
      return {
        isActive: state.isActive,
        fuelRatio,
        boostedSpeed: state.boostedSpeed,
      };
    }

    if (state.isActive) {
      const drainRatio = config.fuelCapacityMs > 0 ? effectiveElapsed / config.fuelCapacityMs : 1;
      const remainingFuelRatio = fuelRatio - drainRatio;

      if (remainingFuelRatio > 0) {
        return {
          isActive: true,
          fuelRatio: remainingFuelRatio,
          boostedSpeed: state.boostedSpeed,
        };
      }

      const drainTimeToEmptyMs = fuelRatio * config.fuelCapacityMs;
      const rechargeElapsedMs = Math.max(0, effectiveElapsed - drainTimeToEmptyMs);
      const rechargeRatio = config.cooldownMs > 0 ? rechargeElapsedMs / config.cooldownMs : 1;

      return {
        isActive: false,
        fuelRatio: rechargeRatio,
        boostedSpeed: state.boostedSpeed,
      };
    }

    const rechargeRatio = config.cooldownMs > 0 ? effectiveElapsed / config.cooldownMs : 1;
    return {
      isActive: false,
      fuelRatio: fuelRatio + rechargeRatio,
      boostedSpeed: state.boostedSpeed,
    };
  }

  private clampRatio(value: number): number {
    if (!Number.isFinite(value)) {
      return 0;
    }
    return Math.min(1, Math.max(0, value));
  }
}