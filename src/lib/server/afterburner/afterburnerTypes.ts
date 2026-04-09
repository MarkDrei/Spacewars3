/**
 * Types for the afterburner active ability state management.
 *
 * Duration and cooldown are stored as raw values (not time-multiplied).
 * The timeMultiplier is applied when checking elapsed time so that
 * changes to the multiplier take effect immediately.
 */

export interface AfterburnerState {
  userId: number;
  activatedAtMs: number; // Date.now() when activated
  durationMs: number; // total duration in ms (from research, raw — NOT time-multiplied)
  cooldownMs: number; // total cooldown in ms (from research, raw)
  boostedSpeed: number; // the speed set during boost
}
