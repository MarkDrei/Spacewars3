/**
 * Global debug state manager for the game
 * Provides a centralized way to control debug rendering flags
 */

class DebugState {
  private areDebugDrawingsEnabled: boolean = true;

  /**
   * Get the current state of debug drawings
   */
  get debugDrawingsEnabled(): boolean {
    return this.areDebugDrawingsEnabled;
  }

  /**
   * Set the debug drawings state
   */
  setDebugDrawingsEnabled(enabled: boolean): void {
    this.areDebugDrawingsEnabled = enabled;
  }

}

// Create a singleton instance
export const debugState = new DebugState();