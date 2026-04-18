/**
 * Types for the afterburner active ability state management.
 *
 * Duration and cooldown are stored as raw values (not time-multiplied).
 * The timeMultiplier is applied when checking elapsed time so that
 * changes to the multiplier take effect immediately.
 */

export interface AfterburnerState {
  userId: number;
  updatedAtMs: number; // Date.now() when the current fuel snapshot was last persisted
  fuelRatio: number; // 0..1 remaining fuel at updatedAtMs
  isActive: boolean;
  boostedSpeed: number; // the speed applied for the current/last boost session
}

export interface AfterburnerConfig {
  timeMultiplier: number;
  fuelCapacityMs: number;
  cooldownMs: number;
  boostedSpeed: number;
}

export interface AfterburnerStatusSnapshot {
  isActive: boolean;
  canActivate: boolean;
  fuelRatio: number;
  fuelRemainingMs: number;
  fuelCapacityMs: number;
  fuelPercent: number;
  boostRemainingMs: number;
  cooldownRemainingMs: number;
  timeToActivationMs: number;
  boostedSpeed: number;
}
