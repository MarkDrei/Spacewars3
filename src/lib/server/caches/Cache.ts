/**
 * Base class for all cache implementations
 * Provides common functionality for test mode detection and persistence control
 */
export abstract class Cache {
  /**
   * Test mode flag - automatically detects test environment
   * When true, background persistence should be disabled
   */
  protected readonly isTestMode: boolean = process.env.NODE_ENV === 'test';

  /**
   * Check if background persistence should be enabled
   * @param enableAutoPersistence - Configuration flag for auto-persistence
   * @returns true if persistence should be enabled, false otherwise
   */
  protected shouldEnableBackgroundPersistence(enableAutoPersistence: boolean): boolean {
    if (this.isTestMode) {
      return false;
    }
    return enableAutoPersistence;
  }
}