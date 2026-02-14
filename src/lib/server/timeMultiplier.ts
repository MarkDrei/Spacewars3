/**
 * TimeMultiplierService - In-memory singleton for managing game time acceleration
 * 
 * This service stores the current time multiplier (e.g., 10x) used to accelerate
 * all time-based game calculations without affecting real timestamps.
 * 
 * Not persisted to database - state is reset on server restart.
 */

/**
 * Status information for the current time multiplier
 */
export interface TimeMultiplierStatus {
  multiplier: number;
  expiresAt: number | null;
  activatedAt: number | null;
  remainingSeconds: number;
}

/**
 * In-memory state for time multiplier
 */
interface TimeMultiplierState {
  multiplier: number;
  expiresAt: number | null;
  activatedAt: number | null;
}

// Global singleton storage
declare global {
  var timeMultiplierServiceInstance: TimeMultiplierService | undefined;
}

/**
 * TimeMultiplierService singleton - manages game speed multiplier
 */
export class TimeMultiplierService {
  private state: TimeMultiplierState;

  private constructor() {
    this.state = {
      multiplier: 1,
      expiresAt: null,
      activatedAt: null,
    };
  }

  /**
   * Get the singleton instance
   */
  static getInstance(): TimeMultiplierService {
    if (!globalThis.timeMultiplierServiceInstance) {
      globalThis.timeMultiplierServiceInstance = new TimeMultiplierService();
    }
    return globalThis.timeMultiplierServiceInstance;
  }

  /**
   * Get current time multiplier, automatically resets to 1 if expired
   * @returns Current multiplier value (default 1)
   */
  getMultiplier(): number {
    // Check for expiration
    if (this.state.expiresAt !== null && Date.now() >= this.state.expiresAt) {
      // Expired - reset to default
      this.state.multiplier = 1;
      this.state.expiresAt = null;
      this.state.activatedAt = null;
    }
    return this.state.multiplier;
  }

  /**
   * Set time multiplier with expiration duration
   * @param value - Multiplier value (must be >= 1)
   * @param durationMinutes - Duration in minutes (must be > 0)
   * @throws Error if validation fails
   */
  setMultiplier(value: number, durationMinutes: number): void {
    // Validation
    if (value < 1) {
      throw new Error('Multiplier must be >= 1');
    }
    if (durationMinutes <= 0) {
      throw new Error('Duration must be > 0');
    }

    const now = Date.now();
    this.state.multiplier = value;
    this.state.activatedAt = now;
    this.state.expiresAt = now + durationMinutes * 60 * 1000;
  }

  /**
   * Get full status information for admin UI
   * @returns Status object with multiplier, timestamps, and remaining time
   */
  getStatus(): TimeMultiplierStatus {
    // Trigger auto-reset if expired (via getMultiplier)
    const currentMultiplier = this.getMultiplier();
    
    // Calculate remaining seconds
    let remainingSeconds = 0;
    if (this.state.expiresAt !== null) {
      const remaining = this.state.expiresAt - Date.now();
      remainingSeconds = Math.max(0, Math.ceil(remaining / 1000));
    }

    return {
      multiplier: currentMultiplier,
      expiresAt: this.state.expiresAt,
      activatedAt: this.state.activatedAt,
      remainingSeconds,
    };
  }

  /**
   * Reset to default state (for testing)
   */
  reset(): void {
    this.state.multiplier = 1;
    this.state.expiresAt = null;
    this.state.activatedAt = null;
  }

  /**
   * Reset singleton instance (for testing)
   */
  static resetInstance(): void {
    if (globalThis.timeMultiplierServiceInstance) {
      globalThis.timeMultiplierServiceInstance.reset();
    }
    globalThis.timeMultiplierServiceInstance = undefined;
  }
}

// Export singleton instance for convenient access
export const timeMultiplierService = TimeMultiplierService.getInstance();
